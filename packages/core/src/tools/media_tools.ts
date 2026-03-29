// Phase 10: Media AI tools (image gen, image edit, audio/video transcription, video gen, diagrams)

import { ToolDefinition } from './types.js';
import { generateImage } from '../services/media/image-gen.js';
import { editImage, removeBackground, upscale } from '../services/media/image-edit.js';
import { transcribeAudio } from '../services/media/transcription.js';
import { transcribeVideo } from '../services/media/video-transcription.js';
import { generateVideo } from '../services/media/video-gen.js';
import { generateDiagram } from '../services/media/diagrams.js';

// --- Image Generation ---
export const generateImageTool: ToolDefinition<{
  prompt: string;
  model?: string;
  size?: string;
}> = {
  name: 'generate_image',
  description: 'Generate an image from a text prompt using fal.ai (FLUX.2 Pro, GPT Image, Recraft V3, Ideogram V3, Seedream). The image is saved to the workspace.',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Text description of the image to generate' },
      model: {
        type: 'string',
        enum: ['flux-pro', 'gpt-image', 'recraft-v3', 'ideogram-v3', 'seedream', 'nano-banana'],
        description: 'Model to use. flux-pro (default, best quality), gpt-image (OpenAI), recraft-v3 (text/vector), ideogram-v3, seedream (Google), nano-banana (Google fast)',
      },
      size: { type: 'string', description: 'Image size (e.g. 1024x1024, 1792x1024). Default: 1024x1024' },
    },
    required: ['prompt'],
  },
  async execute(params) {
    return generateImage(params.prompt, {
      model: params.model as any,
      size: params.size,
    });
  },
};

// --- Image Editing ---
export const editImageTool: ToolDefinition<{
  image_path: string;
  action: 'edit' | 'remove-bg' | 'upscale';
  instruction?: string;
  factor?: number;
}> = {
  name: 'edit_image',
  description: 'Edit an image: AI-powered editing (via fal.ai), background removal, or upscaling.',
  parameters: {
    type: 'object',
    properties: {
      image_path: { type: 'string', description: 'Path to the image in workspace (e.g. files/photo.png)' },
      action: { type: 'string', enum: ['edit', 'remove-bg', 'upscale'], description: 'Edit action to perform' },
      instruction: { type: 'string', description: 'Edit instruction (for edit action)' },
      factor: { type: 'number', description: 'Upscale factor (for upscale action, default 2)' },
    },
    required: ['image_path', 'action'],
  },
  async execute(params) {
    switch (params.action) {
      case 'edit': {
        if (!params.instruction) throw new Error('instruction required for edit action');
        return editImage(params.image_path, params.instruction);
      }
      case 'remove-bg': return removeBackground(params.image_path);
      case 'upscale': return upscale(params.image_path, params.factor);
      default: throw new Error(`Unknown action: ${params.action}`);
    }
  },
};

// --- Audio Transcription ---
export const transcribeAudioTool: ToolDefinition<{
  file_path: string;
  timestamps?: boolean;
}> = {
  name: 'transcribe_audio',
  description: 'Transcribe an audio file to text using Groq Whisper (228x real-time speed) or OpenAI Whisper. Supports mp3, wav, m4a, ogg, flac, webm.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to audio file in workspace' },
      timestamps: { type: 'boolean', description: 'Include timestamps for each segment (default false)' },
    },
    required: ['file_path'],
  },
  async execute(params) {
    return transcribeAudio(params.file_path, params.timestamps);
  },
};

// --- Video Transcription ---
export const transcribeVideoTool: ToolDefinition<{
  file_path: string;
}> = {
  name: 'transcribe_video',
  description: 'Transcribe a video file to text. Extracts audio via ffmpeg, then transcribes with Groq Whisper (or OpenAI Whisper fallback). Returns timestamped segments.',
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Path to video file in workspace' },
    },
    required: ['file_path'],
  },
  async execute(params) {
    return transcribeVideo(params.file_path);
  },
};

// --- Video Generation ---
export const generateVideoTool: ToolDefinition<{
  image_path: string;
  prompt?: string;
  duration?: number;
  model?: string;
}> = {
  name: 'generate_video',
  description: 'Generate a short video clip from an image using fal.ai (Kling V2, Veo 3, Wan 2.1).',
  parameters: {
    type: 'object',
    properties: {
      image_path: { type: 'string', description: 'Path to source image in workspace' },
      prompt: { type: 'string', description: 'Optional prompt to guide video generation' },
      duration: { type: 'number', description: 'Duration in seconds (default ~2s)' },
      model: {
        type: 'string',
        enum: ['kling', 'veo', 'wan'],
        description: 'Video model: kling (default, Kling V2), veo (Google Veo 3), wan (Wan 2.1)',
      },
    },
    required: ['image_path'],
  },
  async execute(params) {
    return generateVideo(params.image_path, params.prompt, params.duration, params.model as any);
  },
};

// --- Diagram Generation ---
export const createDiagramTool: ToolDefinition<{
  code: string;
  format?: 'svg' | 'png';
}> = {
  name: 'create_diagram',
  description: 'Generate a diagram from D2 language code. D2 is a declarative diagramming language. The diagram is saved to workspace.',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'D2 diagram code (e.g. "A -> B -> C")' },
      format: { type: 'string', enum: ['svg', 'png'], description: 'Output format (default: svg)' },
    },
    required: ['code'],
  },
  async execute(params) {
    return generateDiagram(params.code, params.format);
  },
};

export const describeDiagramTool: ToolDefinition<{
  description: string;
  format?: 'svg' | 'png';
}> = {
  name: 'describe_diagram',
  description: 'Generate a diagram from a natural language description. Converts description to D2 code and renders it.',
  parameters: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Natural language description of the diagram' },
      format: { type: 'string', enum: ['svg', 'png'], description: 'Output format (default: svg)' },
    },
    required: ['description'],
  },
  async execute(params) {
    const { diagramFromDescription } = await import('../services/media/diagrams.js');
    return diagramFromDescription(params.description);
  },
};
