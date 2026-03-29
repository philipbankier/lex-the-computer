// Phase 10: Video Generation service
// Primary: fal.ai (Kling, Veo, Wan)
// Fallback: none (legacy Replicate/Stability removed)

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

type VideoModel = 'kling' | 'veo' | 'wan';

type VideoOptions = {
  model?: VideoModel;
  prompt?: string;
  duration?: number;
};

const FAL_VIDEO_MAP: Record<VideoModel, string> = {
  'kling': 'fal-ai/kling-video/v2/master/image-to-video',
  'veo': 'fal-ai/veo3',
  'wan': 'fal-ai/wan/v2.1/image-to-video',
};

export async function generateVideo(
  imagePath: string,
  prompt?: string,
  duration?: number,
  model?: VideoModel,
): Promise<{ path: string; provider: string; model: string }> {
  if (!env.FAL_KEY) {
    throw new Error('FAL_KEY is required for video generation. Set FAL_KEY in your environment.');
  }

  const { fal } = await import('@fal-ai/client');
  fal.config({ credentials: env.FAL_KEY });

  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  const imageUrl = await fal.storage.upload(new Blob([imageData], { type: 'image/png' }));

  const modelKey = model || 'kling';
  const modelId = FAL_VIDEO_MAP[modelKey];
  if (!modelId) throw new Error(`Unknown video model: ${modelKey}`);

  const input: Record<string, unknown> = { image_url: imageUrl };
  if (prompt) input.prompt = prompt;
  if (duration) input.duration = duration;

  const result = await fal.subscribe(modelId, { input }) as any;

  const video = result?.data?.video || result?.video;
  if (!video?.url) {
    throw new Error('fal.ai returned no video URL');
  }

  const vidRes = await fetch(video.url);
  if (!vidRes.ok) throw new Error(`Failed to download fal.ai video: ${vidRes.status}`);
  const buffer = Buffer.from(await vidRes.arrayBuffer());
  const filename = `generated-${Date.now()}.mp4`;
  const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
  await fs.writeFile(outPath, buffer);
  return { path: `files/${filename}`, provider: 'fal.ai', model: modelKey };
}
