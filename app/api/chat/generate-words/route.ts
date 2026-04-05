/**
 * POST /api/chat/generate-words
 *
 * Generates age-appropriate words, sentences, or instructions for
 * speech echo and comprehension stages. Falls back to curated
 * age-stratified pools when Bedrock is unavailable.
 *
 * Request body:
 *   { ageMonths: number, count?: number, mode: "words"|"sentences"|"instructions" }
 *
 * Response:
 *   { items: Array<{ text: string, emoji: string }>, fallback: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { getAppCredentials } from "../../../lib/aws/credentials";
import { logger } from "../../../lib/logger";

const log = logger("chat/generate-words");

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Mode = "words" | "sentences" | "instructions";

interface GenerateRequest {
  ageMonths: number;
  count?: number;
  mode: Mode;
}

interface GeneratedItem {
  text: string;
  emoji: string;
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
/*  Fallback pools — curated, age-stratified                           */
/* ------------------------------------------------------------------ */

const WORD_EMOJIS: Record<string, string> = {
  mama: "👩", dada: "👨", ball: "⚽", dog: "🐶", cat: "🐱", milk: "🥛",
  more: "➕", up: "⬆️", bye: "👋", hi: "🙋", book: "📖", shoe: "👟",
  hat: "🎩", cup: "🥤", fish: "🐟", duck: "🦆", apple: "🍎", baby: "👶",
  car: "🚗", bird: "🐦", banana: "🍌", elephant: "🐘", butterfly: "🦋",
  dinosaur: "🦕", rainbow: "🌈", chocolate: "🍫", hello: "👋", purple: "🟣",
  circle: "⭕", triangle: "🔺", giraffe: "🦒", penguin: "🐧", rocket: "🚀",
  princess: "👸", monster: "👹", umbrella: "☂️", pumpkin: "🎃",
  strawberry: "🍓", airplane: "✈️", crocodile: "🐊", computer: "💻",
  adventure: "🗺️", incredible: "🌟", beautiful: "🌸", discovery: "🔍",
  astronaut: "🧑‍🚀", magnificent: "✨", helicopter: "🚁", wonderful: "💫",
  caterpillar: "🐛", watermelon: "🍉", constellation: "⭐", basketball: "🏀",
  trampoline: "🤸", hippopotamus: "🦛", refrigerator: "🧊", thermometer: "🌡️",
  xylophone: "🎵", vocabulary: "📝", harmonica: "🎶",
};

const FALLBACK_WORDS: Record<string, string[]> = {
  young: ["mama", "dada", "ball", "dog", "cat", "milk", "more", "up", "bye", "hi",
          "book", "shoe", "hat", "cup", "fish", "duck", "apple", "baby", "car", "bird"],
  mid:   ["banana", "elephant", "butterfly", "dinosaur", "rainbow", "chocolate", "hello",
          "purple", "circle", "triangle", "giraffe", "penguin", "rocket", "princess",
          "monster", "umbrella", "pumpkin", "strawberry", "airplane", "crocodile"],
  old:   ["computer", "adventure", "incredible", "beautiful", "discovery", "astronaut",
          "magnificent", "helicopter", "wonderful", "caterpillar", "watermelon",
          "constellation", "basketball", "trampoline", "hippopotamus", "refrigerator",
          "thermometer", "xylophone", "vocabulary", "harmonica"],
};

const FALLBACK_SENTENCES: Record<string, GeneratedItem[]> = {
  young: [
    { text: "The cat is big", emoji: "🐱" },
    { text: "I like dogs", emoji: "🐶" },
    { text: "My ball is red", emoji: "⚽" },
    { text: "I see a bird", emoji: "🐦" },
    { text: "The sun is hot", emoji: "☀️" },
    { text: "I want milk", emoji: "🥛" },
  ],
  mid: [
    { text: "The butterfly is very pretty", emoji: "🦋" },
    { text: "I want to go outside and play", emoji: "🏃" },
    { text: "My favorite color is blue", emoji: "🔵" },
    { text: "The dog is running in the park", emoji: "🐶" },
    { text: "I can count to ten", emoji: "🔢" },
    { text: "The moon comes out at night", emoji: "🌙" },
  ],
  old: [
    { text: "The elephant walked through the tall jungle", emoji: "🐘" },
    { text: "Can you tell me about your favorite game", emoji: "🎮" },
    { text: "The beautiful rainbow appeared after the rain", emoji: "🌈" },
    { text: "I like to read books before bedtime", emoji: "📚" },
    { text: "The spaceship flew high into the sky", emoji: "🚀" },
    { text: "My friend and I played at the park today", emoji: "🏞️" },
  ],
};

const FALLBACK_INSTRUCTIONS: Record<string, GeneratedItem[]> = {
  young: [
    { text: "Clap your hands", emoji: "👏" },
    { text: "Wave bye bye", emoji: "👋" },
    { text: "Say your name", emoji: "🗣️" },
    { text: "Touch your nose", emoji: "👃" },
    { text: "Say mama", emoji: "👩" },
  ],
  mid: [
    { text: "Clap your hands two times", emoji: "👏" },
    { text: "Say hello and then wave", emoji: "👋" },
    { text: "Count to three out loud", emoji: "🔢" },
    { text: "Tell me something that is red", emoji: "🔴" },
    { text: "Say the word butterfly", emoji: "🦋" },
  ],
  old: [
    { text: "Clap your hands then touch your head", emoji: "👏" },
    { text: "Say your name and how old you are", emoji: "🗣️" },
    { text: "Count backwards from five", emoji: "🔢" },
    { text: "Tell me your favorite animal and why", emoji: "🐾" },
    { text: "Say a long word like hippopotamus", emoji: "🦛" },
  ],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAgeBracket(ageMonths: number): string {
  if (ageMonths < 36) return "young";
  if (ageMonths < 60) return "mid";
  return "old";
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickFallbackWords(ageMonths: number, count: number): GeneratedItem[] {
  const bracket = getAgeBracket(ageMonths);
  const pool = FALLBACK_WORDS[bracket];
  return shuffle(pool).slice(0, count).map((w) => ({
    text: w,
    emoji: WORD_EMOJIS[w] || "🔤",
  }));
}

function pickFallbackSentences(ageMonths: number, count: number): GeneratedItem[] {
  const bracket = getAgeBracket(ageMonths);
  return shuffle(FALLBACK_SENTENCES[bracket]).slice(0, count);
}

function pickFallbackInstructions(ageMonths: number, count: number): GeneratedItem[] {
  const bracket = getAgeBracket(ageMonths);
  return shuffle(FALLBACK_INSTRUCTIONS[bracket]).slice(0, count);
}

function pickFallback(mode: Mode, ageMonths: number, count: number): GeneratedItem[] {
  switch (mode) {
    case "words": return pickFallbackWords(ageMonths, count);
    case "sentences": return pickFallbackSentences(ageMonths, count);
    case "instructions": return pickFallbackInstructions(ageMonths, count);
  }
}

/* ------------------------------------------------------------------ */
/*  Bedrock generation                                                 */
/* ------------------------------------------------------------------ */

function buildPrompt(mode: Mode, ageMonths: number, count: number): string {
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const ageStr = months > 0 ? `${years} years and ${months} months` : `${years} years`;

  switch (mode) {
    case "words":
      return `Generate exactly ${count} age-appropriate single words for a ${ageStr}-old child to repeat in a speech echo test. Mix easy and slightly challenging words. Use concrete nouns and simple words the child would know. Each word should have a relevant emoji. Return ONLY valid JSON array (no markdown, no code blocks): [{"text":"banana","emoji":"🍌"},...]`;
    case "sentences":
      return `Generate exactly ${count} short sentences (3-8 words each) appropriate for a ${ageStr}-old child to repeat in a speech test. Use familiar objects and actions. Each sentence should have a relevant emoji. Return ONLY valid JSON array (no markdown, no code blocks): [{"text":"The cat is sleeping","emoji":"🐱"},...]`;
    case "instructions":
      return `Generate exactly ${count} simple audio instructions for a ${ageStr}-old child. Each should ask them to do or say something simple and fun. Each instruction should have a relevant emoji. Return ONLY valid JSON array (no markdown, no code blocks): [{"text":"Clap your hands two times","emoji":"👏"},...]`;
  }
}

function parseItems(raw: string): GeneratedItem[] | null {
  try {
    // Try direct parse
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
      return parsed;
    }
  } catch {
    // Try extracting JSON array from text
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].text) {
          return parsed;
        }
      } catch { /* fall through */ }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  // Auth gate
  const { requireApiAuth } = await import("../../../lib/auth/requireApiAuth");
  const authResult = await requireApiAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  // Rate limit
  const { aiRateLimiter } = await import("../../../lib/rateLimit");
  const rl = aiRateLimiter.check(authResult.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body: GenerateRequest = await request.json();
    const { ageMonths = 36, count = 6, mode = "words" } = body;

    if (!["words", "sentences", "instructions"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const clampedCount = Math.max(1, Math.min(count, 10));

    // Try Bedrock first
    try {
      const client = getBedrockClient();
      const prompt = buildPrompt(mode, ageMonths, clampedCount);

      const command = new InvokeModelCommand({
        modelId: "amazon.nova-lite-v1:0",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          messages: [{ role: "user", content: [{ text: prompt }] }],
          inferenceConfig: { maxTokens: 500, temperature: 0.8 },
        }),
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await client.send(command, { abortSignal: controller.signal });
      clearTimeout(timeout);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const text = responseBody?.output?.message?.content?.[0]?.text;

      if (text) {
        const items = parseItems(text);
        if (items && items.length >= clampedCount) {
          return NextResponse.json({
            items: items.slice(0, clampedCount),
            fallback: false,
          });
        }
      }
    } catch {
      // Bedrock failed or timed out — use fallback
    }

    // Fallback
    return NextResponse.json({
      items: pickFallback(mode, ageMonths, clampedCount),
      fallback: true,
    });
  } catch (err) {
    log.error("Unexpected error", { error: err });
    return NextResponse.json(
      { error: "Failed to generate words" },
      { status: 500 },
    );
  }
}
