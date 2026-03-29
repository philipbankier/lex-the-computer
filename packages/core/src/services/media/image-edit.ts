// Phase 10: Image Editing service
// AI-powered editing, background removal, upscaling

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function editImage(imagePath: string, instruction: string): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.OPENAI_API_KEY) {
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'image.png');
    formData.append('prompt', instruction);
    formData.append('model', 'dall-e-2');
    formData.append('n', '1');
    formData.append('size', '1024x1024');
    formData.append('response_format', 'b64_json');

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`OpenAI image edit failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const buffer = Buffer.from(data.data[0].b64_json, 'base64');
    const filename = `edited-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

  throw new Error('No image editing provider configured. Set OPENAI_API_KEY.');
}

export async function removeBackground(imagePath: string): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.STABILITY_API_KEY) {
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'image.png');
    formData.append('output_format', 'png');

    const res = await fetch('https://api.stability.ai/v2beta/stable-image/edit/remove-background', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STABILITY_API_KEY}`, Accept: 'image/*' },
      body: formData,
    });
    if (!res.ok) throw new Error(`Stability remove-bg failed: ${res.status} ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `nobg-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

  if (env.REPLICATE_API_TOKEN) {
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: 'fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003', // rembg
        input: { image: `data:image/png;base64,${imageData.toString('base64')}` },
      }),
    });
    if (!createRes.ok) throw new Error(`Replicate remove-bg failed: ${createRes.status}`);
    let prediction = await createRes.json();
    for (let i = 0; i < 60; i++) {
      if (prediction.status === 'succeeded') break;
      if (prediction.status === 'failed') throw new Error(`Remove-bg failed: ${prediction.error}`);
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
    }
    if (prediction.status !== 'succeeded') throw new Error('Remove-bg timed out');
    const imgRes = await fetch(prediction.output);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `nobg-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

  throw new Error('No provider configured for background removal. Set STABILITY_API_KEY or REPLICATE_API_TOKEN.');
}

export async function upscale(imagePath: string, factor: number = 2): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.STABILITY_API_KEY) {
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'image.png');
    formData.append('output_format', 'png');

    const res = await fetch('https://api.stability.ai/v2beta/stable-image/upscale/fast', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STABILITY_API_KEY}`, Accept: 'image/*' },
      body: formData,
    });
    if (!res.ok) throw new Error(`Stability upscale failed: ${res.status} ${await res.text()}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = `upscaled-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

  throw new Error('No provider configured for upscaling. Set STABILITY_API_KEY.');
}
