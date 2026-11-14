import { HttpException, HttpStatus } from '@nestjs/common';

import { ApiMsg } from '../../common/api-messages';

export interface LlmChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmClientOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs?: number;
}

export interface LlmChatResult {
  content: string;
  model: string;
}

export type LlmStreamEvent =
  | { type: 'thinking'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; model: string };

type StreamDelta = {
  content?: string | null;
  reasoning_content?: string | null;
  reasoning?: string | null;
  thinking?: string | null;
};

function readThinkingDelta(delta: StreamDelta | undefined): string | null {
  if (!delta) return null;
  for (const key of ['reasoning_content', 'reasoning', 'thinking'] as const) {
    const value = delta[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

function mergeAbortSignals(
  timeoutMs: number,
  external?: AbortSignal
): {
  signal: AbortSignal | undefined;
  clear: () => void;
} {
  if (typeof AbortController === 'undefined') {
    return { signal: external, clear: () => undefined };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timeout);
      external?.removeEventListener('abort', onExternalAbort);
    },
  };
}

async function readProviderErrorMessage(res: Response): Promise<string> {
  const fallback = `LLM request failed (${res.status})`;
  try {
    const text = await res.text();
    if (!text) return fallback;
    const body = JSON.parse(text) as { error?: { message?: string } };
    return body.error?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function chatCompletionsJson(
  options: LlmClientOptions,
  messages: LlmChatMessage[]
): Promise<LlmChatResult> {
  const base = options.baseUrl.replace(/\/$/, '');
  const url = `${base}/chat/completions`;
  const { signal, clear } = mergeAbortSignals(options.timeoutMs ?? 120_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
      signal,
    });

    const text = await res.text();
    let body: {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
    } = {};
    try {
      body = text ? (JSON.parse(text) as typeof body) : {};
    } catch {
      throw new HttpException(ApiMsg.AI_PROVIDER_INVALID_RESPONSE, HttpStatus.BAD_GATEWAY);
    }

    if (!res.ok) {
      const msg = body.error?.message || `LLM request failed (${res.status})`;
      throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
    }

    const content = body.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new HttpException(ApiMsg.AI_PROVIDER_EMPTY, HttpStatus.BAD_GATEWAY);
    }

    return { content, model: body.model || options.model };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpException(`${ApiMsg.AI_PROVIDER_ERROR}: ${message}`, HttpStatus.BAD_GATEWAY);
  } finally {
    clear();
  }
}

/** OpenAI-compatible chat completions with `stream: true` (SSE). */
export async function* chatCompletionsStream(
  options: LlmClientOptions,
  messages: LlmChatMessage[],
  externalSignal?: AbortSignal
): AsyncGenerator<LlmStreamEvent> {
  const base = options.baseUrl.replace(/\/$/, '');
  const url = `${base}/chat/completions`;
  const { signal, clear } = mergeAbortSignals(options.timeoutMs ?? 180_000, externalSignal);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${options.apiKey}`,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: 0.5,
        stream: true,
      }),
      signal,
    });

    if (!res.ok) {
      const msg = await readProviderErrorMessage(res);
      throw new HttpException(msg, HttpStatus.BAD_GATEWAY);
    }

    if (!res.body) {
      throw new HttpException(ApiMsg.AI_PROVIDER_EMPTY, HttpStatus.BAD_GATEWAY);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let model = options.model;
    let sawOutput = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          if (!sawOutput) {
            throw new HttpException(ApiMsg.AI_PROVIDER_EMPTY, HttpStatus.BAD_GATEWAY);
          }
          yield { type: 'done', model };
          return;
        }
        let chunk: {
          model?: string;
          choices?: Array<{ delta?: StreamDelta }>;
        };
        try {
          chunk = JSON.parse(payload) as typeof chunk;
        } catch {
          continue;
        }
        if (chunk.model) model = chunk.model;
        const delta = chunk.choices?.[0]?.delta;
        const thinking = readThinkingDelta(delta);
        if (thinking) {
          sawOutput = true;
          yield { type: 'thinking', text: thinking };
        }
        const content = delta?.content;
        if (typeof content === 'string' && content.length > 0) {
          sawOutput = true;
          yield { type: 'delta', text: content };
        }
      }
    }

    if (!sawOutput) {
      throw new HttpException(ApiMsg.AI_PROVIDER_EMPTY, HttpStatus.BAD_GATEWAY);
    }
    yield { type: 'done', model };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpException(`${ApiMsg.AI_PROVIDER_ERROR}: ${message}`, HttpStatus.BAD_GATEWAY);
  } finally {
    clear();
  }
}
