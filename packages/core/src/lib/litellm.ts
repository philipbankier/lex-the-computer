import { env } from './env.js';

export type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; name?: string; tool_call_id?: string };
export type ToolSpec = { type: 'function'; function: { name: string; description?: string; parameters?: any } };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: ToolSpec[];
  tool_choice?: 'auto' | { type: 'function'; function: { name: string } };
};

export async function streamChat(req: ChatRequest, onChunk: (chunk: string) => void) {
  const url = `${env.LITELLM_BASE_URL.replace(/\/$/, '')}/v1/chat/completions`;
  const controller = new AbortController();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: true }),
    signal: controller.signal,
  }).catch((e: any) => {
    // Fallback: stream a mock response
    const fallback = 'LiteLLM unavailable. This is a mock streaming response.';
    for (const part of fallback.split(' ')) onChunk(part + ' ');
    return null as any;
  });
  if (!res || !res.ok || !res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    onChunk(text);
  }
}
