// Phase 10: Video Generation service
// Generates short video clips from images using Replicate or Stability AI

import { env } from '../../lib/env.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export async function generateVideo(
  imagePath: string,
  prompt?: string,
  duration?: number,
): Promise<{ path: string }> {
  const absPath = path.isAbsolute(imagePath) ? imagePath : path.join(env.WORKSPACE_DIR, imagePath);
  const imageData = await fs.readFile(absPath);

  if (env.REPLICATE_API_TOKEN) {
    // Use Stable Video Diffusion on Replicate
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        Authorization: `Token ${env.REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: '3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438', // SVD-XT
        input: {
          input_image: `data:image/png;base64,${imageData.toString('base64')}`,
          motion_bucket_id: 127,
          fps: 7,
          num_frames: duration ? Math.min(duration * 7, 25) : 14,
        },
      }),
    });
    if (!createRes.ok) throw new Error(`Replicate video gen failed: ${createRes.status} ${await createRes.text()}`);
    let prediction = await createRes.json();

    // Poll for completion (video gen can be slow)
    for (let i = 0; i < 120; i++) {
      if (prediction.status === 'succeeded') break;
      if (prediction.status === 'failed') throw new Error(`Video generation failed: ${prediction.error}`);
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(prediction.urls.get, {
        headers: { Authorization: `Token ${env.REPLICATE_API_TOKEN}` },
      });
      prediction = await pollRes.json();
    }
    if (prediction.status !== 'succeeded') throw new Error('Video generation timed out');

    const videoUrl = prediction.output;
    const vidRes = await fetch(videoUrl);
    const buffer = Buffer.from(await vidRes.arrayBuffer());
    const filename = `generated-${Date.now()}.mp4`;
    const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
    await fs.writeFile(outPath, buffer);
    return { path: `files/${filename}` };
  }

  if (env.STABILITY_API_KEY) {
    const formData = new FormData();
    formData.append('image', new Blob([imageData], { type: 'image/png' }), 'image.png');
    if (prompt) formData.append('seed', '0');
    formData.append('cfg_scale', '1.8');
    formData.append('motion_bucket_id', '127');

    const res = await fetch('https://api.stability.ai/v2beta/image-to-video', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STABILITY_API_KEY}` },
      body: formData,
    });
    if (!res.ok) throw new Error(`Stability video gen failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    const generationId = data.id;

    // Poll for result
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const pollRes = await fetch(`https://api.stability.ai/v2beta/image-to-video/result/${generationId}`, {
        headers: { Authorization: `Bearer ${env.STABILITY_API_KEY}`, Accept: 'video/*' },
      });
      if (pollRes.status === 200) {
        const buffer = Buffer.from(await pollRes.arrayBuffer());
        const filename = `generated-${Date.now()}.mp4`;
        const outPath = path.join(env.WORKSPACE_DIR, 'files', filename);
        await fs.writeFile(outPath, buffer);
        return { path: `files/${filename}` };
      }
      if (pollRes.status !== 202) throw new Error(`Video gen poll failed: ${pollRes.status}`);
    }
    throw new Error('Video generation timed out');
  }

  throw new Error('No video generation provider configured. Set REPLICATE_API_TOKEN or STABILITY_API_KEY.');
}
