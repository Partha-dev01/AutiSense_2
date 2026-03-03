/**
 * POST /api/chat/conversation
 *
 * Dynamic AI voice agent for Step 7 developmental screening conversation.
 * Uses Amazon Nova Lite via Bedrock to generate age-appropriate, adaptive
 * conversation turns with the child. Falls back to a pre-defined conversation
 * when AWS credentials are not configured.
 *
 * Request body:
 *   { messages: {role,content}[], childName: string, ageMonths: number, turnNumber: number }
 *
 * Response:
 *   { text: string, metadata: {...}, fallback: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConversationMessage {
  role: "assistant" | "user";
  content: string;
}

interface ConversationRequest {
  messages: ConversationMessage[];
  childName: string;
  ageMonths: number;
  turnNumber: number;
}

interface TurnMetadata {
  turnType: "greeting" | "question" | "instruction" | "follow_up" | "farewell";
  expectsResponse: boolean;
  responseRelevance: number;
  shouldEnd: boolean;
  domain: "social" | "cognitive" | "language" | "motor" | "general";
}

interface ConversationResponse {
  text: string;
  metadata: TurnMetadata;
  fallback: boolean;
}

/* ------------------------------------------------------------------ */
/*  Bedrock client                                                     */
/* ------------------------------------------------------------------ */

const BEDROCK_REGION = process.env.BEDROCK_REGION ?? "us-east-1";

function getBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({ region: BEDROCK_REGION });
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(childName: string, ageMonths: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const ageStr = months > 0 ? `${years} years and ${months} months` : `${years} years`;

  return `You are a warm, friendly voice assistant conducting a brief developmental screening conversation with a child named ${childName} who is ${ageStr} old.

RULES:
1. Keep every response to 1-2 SHORT sentences. This will be spoken aloud by text-to-speech.
2. Use simple, age-appropriate language for a ${years}-year-old.
3. If this is the first turn, greet the child warmly using their name.
4. Ask 5-7 questions or give instructions across these domains:
   - social: "Can you wave hello to me?", "What's your best friend's name?"
   - cognitive: "What color is the sky?", "Can you count to three?"
   - language: "Can you say butterfly?", "Tell me about your favorite animal"
   - motor: "Can you touch your nose?", "Clap your hands for me!"
5. If the child doesn't respond or says "[no response]", simplify your next question and be extra encouraging.
6. If the child responds well, you can ask slightly more complex questions.
7. After 5-8 total assistant turns, end with a warm farewell.
8. Never ask about medical history, diagnosis, or anything clinical.
9. Be encouraging after responses — "Great job!", "That's wonderful!", "You're so smart!"
10. For motor instructions, phrase them as fun games — "Let's play a game! Can you..."

You MUST respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{"text":"Your spoken response here","turnType":"greeting|question|instruction|follow_up|farewell","expectsResponse":true,"responseRelevance":0.5,"shouldEnd":false,"domain":"social|cognitive|language|motor|general"}

For responseRelevance: rate how relevant the child's LAST response was to your LAST question (0.0 = no response or completely irrelevant, 0.5 = somewhat relevant, 1.0 = perfect response). Use 0.5 for the first turn.
For shouldEnd: set to true ONLY on your farewell turn (after 5-8 assistant turns).`;
}

/* ------------------------------------------------------------------ */
/*  Fallback conversation                                              */
/* ------------------------------------------------------------------ */

function buildFallbackTurn(
  childName: string,
  turnNumber: number,
): ConversationResponse {
  const fallback: Array<Omit<ConversationResponse, "fallback">> = [
    {
      text: `Hi ${childName}! I'm so happy to talk with you today! Are you ready to play a fun game with me?`,
      metadata: { turnType: "greeting", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" },
    },
    {
      text: `Awesome! Let's start with something fun. Can you wave hello to me?`,
      metadata: { turnType: "instruction", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "motor" },
    },
    {
      text: `Great job! Now tell me, what color is the sky?`,
      metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "cognitive" },
    },
    {
      text: `You're doing so well! Can you say the word banana for me?`,
      metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "language" },
    },
    {
      text: `That's wonderful! Now let's try something silly. Can you touch your nose?`,
      metadata: { turnType: "instruction", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "motor" },
    },
    {
      text: `You're a superstar! What's your favorite animal?`,
      metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" },
    },
    {
      text: `You did such an amazing job, ${childName}! Thank you so much for talking with me today! You're wonderful!`,
      metadata: { turnType: "farewell", expectsResponse: false, responseRelevance: 0.5, shouldEnd: true, domain: "general" },
    },
  ];

  const idx = Math.min(turnNumber, fallback.length - 1);
  return { ...fallback[idx], fallback: true };
}

/* ------------------------------------------------------------------ */
/*  Parse LLM JSON response                                            */
/* ------------------------------------------------------------------ */

function parseAgentResponse(raw: string): Omit<ConversationResponse, "fallback"> | null {
  // Try direct parse
  try {
    const parsed = JSON.parse(raw);
    if (parsed.text && parsed.turnType) {
      return {
        text: parsed.text,
        metadata: {
          turnType: parsed.turnType ?? "question",
          expectsResponse: parsed.expectsResponse !== false,
          responseRelevance: typeof parsed.responseRelevance === "number" ? parsed.responseRelevance : 0.5,
          shouldEnd: parsed.shouldEnd === true,
          domain: parsed.domain ?? "general",
        },
      };
    }
  } catch { /* not direct JSON */ }

  // Try extracting JSON from markdown code block or raw text
  const jsonMatch =
    raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ??
    raw.match(/(\{"text"[\s\S]*?\})/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.text) {
        return {
          text: parsed.text,
          metadata: {
            turnType: parsed.turnType ?? "question",
            expectsResponse: parsed.expectsResponse !== false,
            responseRelevance: typeof parsed.responseRelevance === "number" ? parsed.responseRelevance : 0.5,
            shouldEnd: parsed.shouldEnd === true,
            domain: parsed.domain ?? "general",
          },
        };
      }
    } catch { /* still not valid */ }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  let body: ConversationRequest;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.childName || typeof body.ageMonths !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: childName and ageMonths" },
      { status: 400 },
    );
  }

  const { messages, childName, ageMonths, turnNumber } = body;

  // Hard cap — force farewell after 8 turns
  if (turnNumber >= 7) {
    return NextResponse.json(
      buildFallbackTurn(childName, 6), // farewell
    );
  }

  const client = getBedrockClient();

  // Build Nova Lite messages array
  // Nova Lite doesn't have a "system" role — embed in first user message
  const novaMessages: Array<{ role: string; content: Array<{ text: string }> }> = [];

  if (!messages || messages.length === 0) {
    // First turn: system prompt asks for greeting
    novaMessages.push({
      role: "user",
      content: [{ text: buildSystemPrompt(childName, ageMonths) + "\n\nPlease greet the child now." }],
    });
  } else {
    // Multi-turn: system prompt + conversation history
    novaMessages.push({
      role: "user",
      content: [{ text: buildSystemPrompt(childName, ageMonths) + "\n\nBegin the conversation." }],
    });

    for (const msg of messages) {
      if (msg.role === "assistant") {
        novaMessages.push({
          role: "assistant",
          content: [{ text: msg.content }],
        });
      } else {
        novaMessages.push({
          role: "user",
          content: [{ text: `The child said: "${msg.content}"` }],
        });
      }
    }
  }

  try {
    const invokeBody = JSON.stringify({
      messages: novaMessages,
      inferenceConfig: { maxTokens: 256, temperature: 0.7 },
    });

    const command = new InvokeModelCommand({
      modelId: "amazon.nova-lite-v1:0",
      contentType: "application/json",
      accept: "application/json",
      body: new TextEncoder().encode(invokeBody),
    });

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const rawText: string =
      responseBody?.output?.message?.content?.[0]?.text ??
      responseBody?.completion ??
      "";

    if (!rawText) {
      console.warn("[Chat] Empty response from Bedrock, using fallback");
      return NextResponse.json(buildFallbackTurn(childName, turnNumber));
    }

    const parsed = parseAgentResponse(rawText);
    if (!parsed) {
      console.warn("[Chat] Failed to parse LLM JSON, using fallback. Raw:", rawText);
      return NextResponse.json(buildFallbackTurn(childName, turnNumber));
    }

    return NextResponse.json({ ...parsed, fallback: false } satisfies ConversationResponse);
  } catch (err) {
    console.error("[Chat] Bedrock invocation failed:", err);
    return NextResponse.json(buildFallbackTurn(childName, turnNumber));
  }
}
