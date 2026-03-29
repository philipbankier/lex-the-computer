// Phase 10: Image Generation service
// Supports OpenAI DALL-E 3, Stability AI, Replicate

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

type ImageOptions = {
  size?: string;
  style?: 'natural' | 'vivid';
  quality?: 'standard' | 'hd';
  provider?: 'openai' | 'stability' | 'replicate';
};

function getProvider(preferred?: string): string {
  if (preferred) {
    if (preferred === 'openai' && env.OPENAI_API_KEY) return 'openai';
    if (preferred === 'stability' && env.STABILITY_API_KEY) return 'stability';
    if (preferred === 'replicate' && env.REPLICATE_API_TOKEN) return 'replicate';
  }
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.STABILITY_API_KEY) return 'stability';
  if (env.REPLICATE_API_TOKEN) return 'replicate';
  throw new Error('No image generation provider configured. Set OPENAI_API_KEY, STABILITY_API_KEY, or REPLICATE_API_TOKEN.');
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
      style: opts.style || 'vivid',
      quality: opts.quality || 'standard',
      response_format: 'b64_json',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI image gen failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Buffer.from(data.data[0].b64_json, 'base64');
}

async function generateWithStability(prompt: string, opts: ImageOptions): Promise<Buffer> {
  const res = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STABILITY_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      width: 1024,
      height: 1024,
      steps: 30,
      samples: 1,
    }),
  });
  if (!res.ok) throw new Error(`Stability AI image gen failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return Buffer.from(data.artifacts[0].base64, 'base64');
}

async function generateWithReplicate(prompt: string): Promise<Buffer> {
  // Create prediction
  const createRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4', // SDXL
      input: { prompt, width: 1024, height: 1024 },
    }),
  });
  if (!createRes.ok) throw new Error(`Replicate image gen failed: ${createRes.status} ${await createRes.text()}`);
  let prediction = await createRes.json();

  // Poll for completion
  for (let i = 0; i < 60; i++) {
    if (prediction.status === 'succeeded') break;
    if (prediction.status === 'failed') throw new Error(`Replicate prediction failed: ${prediction.error}`);
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
    });
    prediction = await pollRes.json();
  }

  if (prediction.status !== 'succeeded') throw new Error('Replicate prediction timed out');
  const imageUrl = prediction.output[0];
  const imgRes = await fetch(imageUrl);
  return Buffer.from(await imgRes.arrayBuffer());
}

export async function generateImage(prompt: string, opts: ImageOptions = {}): Promise<{ path: string; provider: string }> {
  const provider = getProvider(opts.provider);
  let buffer: Buffer;

  switch (provider) {
    case 'openai':
      buffer = await generateWithOpenAI(prompt, opts);
      break;
    case 'stability':
      buffer = await generateWithStability(prompt, opts);
      break;
    case 'replicate':
      buffer = await generateWithReplicate(prompt);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const filename = `generated-${Date.now()}.png`;
  const filePath = path.join(env.WORKSPACE_DIR, 'files', filename);
  await fs.writeFile(filePath, buffer);
  return { path: `files/${filename}`, provider };
}
