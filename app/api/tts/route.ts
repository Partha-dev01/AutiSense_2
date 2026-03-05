/**
 * POST /api/tts
 *
 * Text-to-Speech via Amazon Polly. Returns an audio/mpeg stream of the
 * synthesised speech. Uses neural voice "Joanna" by default.
 *
 * Request body:
 *   { text: string, voiceId?: string }
 *
 * Response:
 *   Binary audio stream (Content-Type: audio/mpeg)
 *   OR 503 if AWS credentials are not configured.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  PollyClient,
  SynthesizeSpeechCommand,
  type VoiceId,
} from "@aws-sdk/client-polly";
import { getAppCredentials, getAppRegion } from "../../lib/aws/credentials";

interface TtsRequestBody {
  text: string;
  voiceId?: string;
}

const POLLY_REGION = process.env.POLLY_REGION || getAppRegion("ap-south-1");

function getPollyClient(): PollyClient {
  const credentials = getAppCredentials();
  return new PollyClient({ region: POLLY_REGION, ...(credentials && { credentials }) });
}

export async function POST(req: NextRequest) {
  let body: TtsRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body?.text || typeof body.text !== "string" || body.text.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or empty required field: text" },
      { status: 400 },
    );
  }

  // Polly has a 3000-character limit for SynthesizeSpeech.
  // Truncate gracefully at the last sentence boundary.
  let text = body.text;
  if (text.length > 2900) {
    const truncated = text.slice(0, 2900);
    const lastSentence = truncated.lastIndexOf(".");
    text = lastSentence > 0 ? truncated.slice(0, lastSentence + 1) : truncated;
  }

  const voiceId = (body.voiceId ?? "Joanna") as VoiceId;

  try {
    const client = getPollyClient();
    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: "neural",
    });

    const response = await client.send(command);

    if (!response.AudioStream) {
      return NextResponse.json(
        { error: "Polly returned no audio stream" },
        { status: 500 },
      );
    }

    // Convert the SDK stream to a Uint8Array
    const chunks: Uint8Array[] = [];
    const stream = response.AudioStream as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("[TTS] Polly synthesis failed:", err);
    return NextResponse.json(
      { error: "Text-to-Speech synthesis failed" },
      { status: 503 },
    );
  }
}
