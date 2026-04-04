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
import { getAppCredentials } from "../../../lib/aws/credentials";

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
  animalPersonality?: string; // "dog" | "cat" | "rabbit" | "parrot" — for kid-dashboard chat
}

interface TurnMetadata {
  turnType: "greeting" | "question" | "instruction" | "follow_up" | "farewell";
  expectsResponse: boolean;
  responseRelevance: number;
  shouldEnd: boolean;
  domain: "social" | "cognitive" | "language" | "motor" | "general";
  action?: string; // For motor instructions: "wave", "touch_nose", "clap", "raise_arms", "touch_head", "touch_ears"
}

interface ConversationResponse {
  text: string;
  metadata: TurnMetadata;
  fallback: boolean;
}

/* ------------------------------------------------------------------ */
/*  Bedrock client                                                     */
/* ------------------------------------------------------------------ */

const BEDROCK_REGION = process.env.BEDROCK_REGION || "us-east-1";

function getBedrockClient(): BedrockRuntimeClient {
  const credentials = getAppCredentials();
  return new BedrockRuntimeClient({ region: BEDROCK_REGION, ...(credentials && { credentials }) });
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */

function buildSystemPrompt(childName: string, ageMonths: number, animalPersonality?: string): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const ageStr = months > 0 ? `${years} years and ${months} months` : `${years} years`;

  const personalityMap: Record<string, string> = {
    dog: "You are Buddy the Dog — enthusiastic, energetic, and encouraging. Use phrases like 'Woof! That's amazing!' and 'Pawsome job!' Be very excited about everything the child says.",
    cat: "You are Whiskers the Cat — calm, gentle, and soothing. Use phrases like 'Purrr... that's lovely' and 'How wonderful...' Be soft-spoken and reassuring.",
    rabbit: "You are Clover the Rabbit — curious, wonder-filled, and inquisitive. Use phrases like 'Oh! I wonder...' and 'How interesting!' Ask follow-up questions gently.",
    parrot: "You are Polly the Parrot — playful, fun-loving, and repetitive. Use phrases like 'Squawk! Say that again!' and 'That's so fun!' Occasionally repeat what the child says with excitement.",
  };

  const personalityInstruction = animalPersonality && personalityMap[animalPersonality]
    ? `\n\nPERSONALITY: ${personalityMap[animalPersonality]}\n`
    : "";

  return `You are a warm, friendly animal buddy having a natural, playful conversation with a child named ${childName} who is ${ageStr} old.${personalityInstruction}

RULES:
1. Keep every response to 1-2 SHORT sentences. This will be spoken aloud by text-to-speech.
2. Use simple, age-appropriate language for a ${years}-year-old.
3. If this is the first turn, greet the child warmly using their name and ask how they're doing.
4. Have a NATURAL conversation — talk about fun topics like:
   - Their favorite things (animals, food, toys, games, colors)
   - Imagination and pretend play ("If you could fly, where would you go?")
   - Their day, friends, family, and things that make them happy
   - Silly questions and jokes to make them laugh
   - Stories and adventures you could go on together
5. ALWAYS respond to what the child actually says. React naturally to their answers before asking something new.
6. If the child says something unexpected or off-topic, go with it! Be playful and curious about what they said.
7. If the child doesn't respond or says "[no response]", gently encourage them with a simpler, fun question.
8. After 5-8 total assistant turns, end with a warm farewell.
9. Never ask about medical history, diagnosis, or anything clinical.
10. Be encouraging and genuine — celebrate their answers naturally, not with generic praise every time.

You MUST respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{"text":"Your spoken response here","turnType":"greeting|question|instruction|follow_up|farewell","expectsResponse":true,"responseRelevance":0.5,"shouldEnd":false,"domain":"social|cognitive|language|motor|general","action":null}

For responseRelevance: rate how relevant the child's LAST response was to your LAST question (0.0 = no response or completely irrelevant, 0.5 = somewhat relevant, 1.0 = perfect response). Use 0.5 for the first turn.
For shouldEnd: set to true ONLY on your farewell turn (after 5-8 assistant turns).
For action: set to null for normal conversation. Only use "wave", "clap", etc. if the conversation naturally leads to a fun physical game.`;
}

/* ------------------------------------------------------------------ */
/*  Fallback conversation                                              */
/* ------------------------------------------------------------------ */

const PERSONALITY_PREFIX: Record<string, string> = {
  dog: "Woof! ",
  cat: "Purrr... ",
  rabbit: "Oh! ",
  parrot: "Squawk! ",
};

function buildFallbackTurn(
  childName: string,
  turnNumber: number,
  animalPersonality?: string,
): ConversationResponse {
  const prefix = (animalPersonality && PERSONALITY_PREFIX[animalPersonality]) || "";

  // Multiple greeting/question pools for variety
  const greetings = [
    `${prefix}Hi ${childName}! I'm so happy to see you! What have you been up to today?`,
    `${prefix}Hello ${childName}! I've been looking forward to chatting with you! How are you doing?`,
    `${prefix}Hey ${childName}! It's so nice to talk with you! What's something fun that happened today?`,
  ];

  const midQuestions: Array<Omit<ConversationResponse, "fallback">> = [
    { text: `${prefix}That's cool! So tell me, what's your favorite thing to play with?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" } },
    { text: `${prefix}Ooh, I love that! If you could have any superpower, what would it be?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "cognitive" } },
    { text: `${prefix}That sounds amazing! Do you have a favorite cartoon or story?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "language" } },
    { text: `${prefix}So fun! If we could go on an adventure anywhere, where would you want to go?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "cognitive" } },
    { text: `${prefix}I love talking with you! What makes you really, really happy?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" } },
    { text: `${prefix}That's awesome! What's your favorite yummy snack?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" } },
    { text: `${prefix}Yum! If you could be any animal in the whole world, which one would you pick?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "language" } },
    { text: `${prefix}Great choice! Do you have a best friend? What do you like to do together?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" } },
    { text: `${prefix}That sounds like so much fun! What's the silliest thing that ever happened to you?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "language" } },
    { text: `${prefix}Ha! That's funny! What do you want to be when you grow up?`, metadata: { turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "cognitive" } },
  ];

  const farewell: Omit<ConversationResponse, "fallback"> = {
    text: `${prefix}You did such an amazing job, ${childName}! Thank you so much for talking with me today! You're wonderful!`,
    metadata: { turnType: "farewell", expectsResponse: false, responseRelevance: 0.5, shouldEnd: true, domain: "general" },
  };

  if (turnNumber === 0) {
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    return {
      text: greeting,
      metadata: { turnType: "greeting", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "social" },
      fallback: true,
    };
  }

  if (turnNumber >= 6) {
    return { ...farewell, fallback: true };
  }

  // Pick from mid-questions, cycling through with some randomness
  const poolIdx = (turnNumber - 1) % midQuestions.length;
  return { ...midQuestions[poolIdx], fallback: true };
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
          ...(parsed.action ? { action: parsed.action } : {}),
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
            ...(parsed.action ? { action: parsed.action } : {}),
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
  // Auth gate — prevent unauthenticated Bedrock usage
  const { requireApiAuth } = await import("../../../lib/auth/requireApiAuth");
  const authResult = await requireApiAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  // Rate limit — 20 requests/min per user for AI routes
  const { aiRateLimiter } = await import("../../../lib/rateLimit");
  const rl = aiRateLimiter.check(authResult.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

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

  const { messages, childName, ageMonths, turnNumber, animalPersonality } = body;

  // Hard cap — force farewell after 15 turns
  if (turnNumber >= 15) {
    return NextResponse.json(
      buildFallbackTurn(childName, 6, animalPersonality), // farewell
    );
  }

  // Build Nova Lite messages array
  // Nova Lite doesn't have a "system" role — embed in first user message
  const novaMessages: Array<{ role: string; content: Array<{ text: string }> }> = [];

  if (!messages || messages.length === 0) {
    // First turn: system prompt asks for greeting
    novaMessages.push({
      role: "user",
      content: [{ text: buildSystemPrompt(childName, ageMonths, animalPersonality) + "\n\nPlease greet the child now." }],
    });
  } else {
    // Multi-turn: system prompt + conversation history
    novaMessages.push({
      role: "user",
      content: [{ text: buildSystemPrompt(childName, ageMonths, animalPersonality) + "\n\nBegin the conversation." }],
    });

    for (const msg of messages) {
      if (msg.role === "assistant") {
        // Wrap plain-text assistant messages in JSON so Nova stays in JSON-output mode
        const isJson = msg.content.trimStart().startsWith("{");
        const wrapped = isJson
          ? msg.content
          : JSON.stringify({ text: msg.content, turnType: "question", expectsResponse: true, responseRelevance: 0.5, shouldEnd: false, domain: "general", action: null });
        novaMessages.push({
          role: "assistant",
          content: [{ text: wrapped }],
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
    const client = getBedrockClient();
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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await client.send(command, { abortSignal: controller.signal });
    clearTimeout(timeout);

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const rawText: string =
      responseBody?.output?.message?.content?.[0]?.text ??
      responseBody?.completion ??
      "";

    if (!rawText) {
      console.warn("[Chat] Empty response from Bedrock, using fallback");
      return NextResponse.json(buildFallbackTurn(childName, turnNumber, animalPersonality));
    }

    const parsed = parseAgentResponse(rawText);
    if (!parsed) {
      console.warn("[Chat] Failed to parse LLM JSON, using fallback. Raw:", rawText);
      return NextResponse.json(buildFallbackTurn(childName, turnNumber, animalPersonality));
    }

    return NextResponse.json({ ...parsed, fallback: false } satisfies ConversationResponse);
  } catch (err) {
    console.error("[Chat] Bedrock invocation failed:", err);
    return NextResponse.json(buildFallbackTurn(childName, turnNumber, animalPersonality));
  }
}
