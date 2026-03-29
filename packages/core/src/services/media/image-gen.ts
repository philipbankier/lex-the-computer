// Phase 10: Image Generation service
// Primary: fal.ai (FLUX.2, GPT Image, Recraft, Ideogram, Seedream)
// Fallback: OpenAI DALL-E 3 (legacy)

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

type ImageModel = 'flux-pro' | 'gpt-image' | 'recraft-v3' | 'ideogram-v3' | 'seedream' | 'nano-banana';

type ImageOptions = {
  model?: ImageModel;
  size?: string;
  style?: string;
};

const FAL_MODEL_MAP: Record<ImageModel, string> = {
  'flux-pro': 'fal-ai/flux-pro/v1.1',
  'gpt-image': 'fal-ai/gpt-image',
  'recraft-v3': 'fal-ai/recraft-v3',
  'ideogram-v3': 'fal-ai/ideogram/v3',
  'seedream': 'fal-ai/seedream-3',
  'nano-banana': 'fal-ai/nano-banana-2',
};

async function generateWithFal(prompt: string, opts: ImageOptions): Promise<Buffer> {
  const { fal } = await import('@fal-ai/client');
  fal.config({ credentials: env.FAL_KEY });

  const modelKey = opts.model || 'flux-pro';
  const modelId = FAL_MODEL_MAP[modelKey];
  if (!modelId) throw new Error(`Unknown fal.ai model: ${modelKey}`);

  const input: Record<string, unknown> = { prompt };
  if (opts.size) {
    const [w, h] = opts.size.split('x').map(Number);
    if (w && h) {
      input.image_size = { width: w, height: h };
    }
  }

  const result = await fal.subscribe(modelId, { input }) as any;

  // fal.ai returns images in result.data.images[0].url or result.images[0].url
  const images = result?.data?.images || result?.images;
  if (!images?.[0]?.url) {
    throw new Error('fal.ai returned no image URL');
  }

  const imgRes = await fetch(images[0].url);
  if (!imgRes.ok) throw new Error(`Failed to download fal.ai image: ${imgRes.status}`);
  return Buffer.from(await imgRes.arrayBuffer());
}

async function generateWithOpenAI(prompt: string, opts: ImageOptions): Promise<Buffer> {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: opts.size || '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI image gen failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Buffer.from(data.data[0].b64_json, 'base64');
}

export async function generateImage(prompt: string, opts: ImageOptions = {}): Promise<{ path: string; provider: string; model: string }> {
  let buffer: Buffer;
  let provider: string;
  let model: string;

  if (env.FAL_KEY) {
    const modelKey = opts.model || 'flux-pro';
    buffer = await generateWithFal(prompt, opts);
    provider = 'fal.ai';
    model = modelKey;
  } else if (env.OPENAI_API_KEY) {
    buffer = await generateWithOpenAI(prompt, opts);
    provider = 'openai';
    model = 'dall-e-3';
  } else {
    throw new Error('No image generation provider configured. Set FAL_KEY (recommended) or OPENAI_API_KEY.');
  }

  const filename = `generated-${Date.now()}.png`;
  const filePath = path.join(env.WORKSPACE_DIR, 'files', filename);
  await fs.writeFile(filePath, buffer);
  return { path: `files/${filename}`, provider, model };
}
