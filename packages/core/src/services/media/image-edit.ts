// Phase 10: Image Editing service
// Primary: fal.ai editing models
// Fallback: OpenAI, Stability AI, Replicate for specific operations

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function editImage(imagePath: string, instruction: string): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.FAL_KEY) {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: env.FAL_KEY });

    // Upload image to fal.ai storage
    const imageUrl = await fal.storage.upload(new Blob([imageData], { type: 'image/png' }));

    const result = await fal.subscribe('fal-ai/flux-pro/v1.1/redux', {
      input: {
        image_url: imageUrl,
        prompt: instruction,
      },
    }) as any;

    const images = result?.data?.images || result?.images;
    if (!images?.[0]?.url) throw new Error('fal.ai edit returned no image URL');

    const imgRes = await fetch(images[0].url);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `edited-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

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

  throw new Error('No image editing provider configured. Set FAL_KEY (recommended) or OPENAI_API_KEY.');
}

export async function removeBackground(imagePath: string): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.FAL_KEY) {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: env.FAL_KEY });

    const imageUrl = await fal.storage.upload(new Blob([imageData], { type: 'image/png' }));
    const result = await fal.subscribe('fal-ai/birefnet', {
      input: { image_url: imageUrl },
    }) as any;

    const image = result?.data?.image || result?.image;
    if (!image?.url) throw new Error('fal.ai remove-bg returned no image URL');

    const imgRes = await fetch(image.url);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `nobg-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

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

  throw new Error('No provider configured for background removal. Set FAL_KEY (recommended) or STABILITY_API_KEY.');
}

export async function upscale(imagePath: string, factor: number = 2): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.FAL_KEY) {
    const { fal } = await import('@fal-ai/client');
    fal.config({ credentials: env.FAL_KEY });

    const imageUrl = await fal.storage.upload(new Blob([imageData], { type: 'image/png' }));
    const result = await fal.subscribe('fal-ai/aura-sr' as any, {
      input: { image_url: imageUrl, upscaling_factor: factor },
    }) as any;

    const image = result?.data?.image || result?.image;
    if (!image?.url) throw new Error('fal.ai upscale returned no image URL');

    const imgRes = await fetch(image.url);
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const filename = `upscaled-${Date.now()}.png`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

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

  throw new Error('No provider configured for upscaling. Set FAL_KEY (recommended) or STABILITY_API_KEY.');
}
