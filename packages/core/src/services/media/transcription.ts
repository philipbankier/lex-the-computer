// Phase 10: Audio Transcription service
// Primary: Groq Whisper (228x real-time speed)
// Fallback: OpenAI Whisper

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

type TranscriptionResult = {
  text: string;
  provider: string;
  segments?: { start: number; end: number; text: string }[];
};

async function transcribeWithGroq(audioData: Buffer, ext: string, timestamps: boolean): Promise<TranscriptionResult> {
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/m4a',
    ogg: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm',
  };

  const formData = new FormData();
  formData.append('file', new Blob([audioData], { type: mimeMap[ext] || 'audio/mpeg' }), `audio.${ext}`);
  formData.append('model', 'whisper-large-v3');
  if (timestamps) {
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Groq Whisper transcription failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const result: TranscriptionResult = { text: data.text, provider: 'groq' };
  if (timestamps && data.segments) {
    result.segments = data.segments.map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    }));
  }
  return result;
}

async function transcribeWithOpenAI(audioData: Buffer, ext: string, timestamps: boolean): Promise<TranscriptionResult> {
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/m4a',
    ogg: 'audio/ogg', flac: 'audio/flac', webm: 'audio/webm',
  };

  const formData = new FormData();
  formData.append('file', new Blob([audioData], { type: mimeMap[ext] || 'audio/mpeg' }), `audio.${ext}`);
  formData.append('model', 'whisper-1');
  if (timestamps) {
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');
  }

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`OpenAI Whisper transcription failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  const result: TranscriptionResult = { text: data.text, provider: 'openai' };
  if (timestamps && data.segments) {
    result.segments = data.segments.map((s: any) => ({
      start: s.start,
      end: s.end,
      text: s.text,
    }));
  }
  return result;
}

export async function transcribeAudio(filePath: string, timestamps = false): Promise<TranscriptionResult> {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(env.WORKSPACE_DIR, filePath);
  const audioData = await fs.readFile(absPath);
  const ext = path.extname(absPath).slice(1) || 'mp3';

  // Prefer Groq (228x faster), fall back to OpenAI
  if (env.GROQ_API_KEY) {
    return transcribeWithGroq(audioData, ext, timestamps);
  }

  if (env.OPENAI_API_KEY) {
    return transcribeWithOpenAI(audioData, ext, timestamps);
  }

  throw new Error('No transcription provider configured. Set GROQ_API_KEY (recommended, 228x faster) or OPENAI_API_KEY.');
}
