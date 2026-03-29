// Phase 10: Audio Transcription service (OpenAI Whisper)

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function transcribeAudio(filePath: string, timestamps = false): Promise<{
  text: string;
  segments?: { start: number; end: number; text: string }[];
}> {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(env.WORKSPACE_DIR, filePath);

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required for audio transcription (Whisper).');
  }

  const audioData = await fs.readFile(absPath);
  const ext = path.extname(absPath).slice(1) || 'mp3';
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

  if (!res.ok) throw new Error(`Whisper transcription failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  if (timestamps && data.segments) {
    return {
      text: data.text,
      segments: data.segments.map((s: any) => ({
        start: s.start,
        end: s.end,
        text: s.text,
      })),
    };
  }

  return { text: data.text };
}
