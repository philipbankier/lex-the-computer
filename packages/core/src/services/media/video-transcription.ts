// Phase 10: Video Transcription service
// Extracts audio from video using ffmpeg, then transcribes with Whisper

import { env } from '../../lib/env.js';
import { transcribeAudio } from './transcription.js';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const execAsync = promisify(exec);

export async function transcribeVideo(filePath: string): Promise<{
  text: string;
  segments?: { start: number; end: number; text: string }[];
}> {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(env.WORKSPACE_DIR, filePath);

  // Check ffmpeg is available
  try {
    await execAsync('which ffmpeg');
  } catch {
    throw new Error('ffmpeg is not installed. Install ffmpeg to transcribe videos.');
  }

  // Extract audio to temp file
  const audioPath = path.join(env.WORKSPACE_DIR, 'files', `.tmp-audio-${Date.now()}.mp3`);
  try {
    await execAsync(`ffmpeg -i "${absPath}" -vn -acodec libmp3lame -q:a 4 -y "${audioPath}"`, {
      timeout: 120000,
    });

    // Transcribe the extracted audio
    const result = await transcribeAudio(audioPath, true);
    return result;
  } finally {
    // Clean up temp audio file
    try { await fs.unlink(audioPath); } catch {}
  }
}
