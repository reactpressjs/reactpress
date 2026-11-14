import { HttpException } from '@nestjs/common';

import { ApiMsg } from '../../common/api-messages';
import { chatCompletionsJson, chatCompletionsStream } from './llm.client';

describe('llm.client', () => {
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = fetchMock as typeof fetch;
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function jsonResponse(status: number, body: unknown, text?: string) {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: jest.fn().mockResolvedValue(text ?? JSON.stringify(body)),
    };
  }

  it('returns parsed content on success', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        model: 'gpt-test',
        choices: [{ message: { content: ' {"ok":true} ' } }],
      })
    );

    const result = await chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://api.example/v1/', model: 'm' }, [
      { role: 'user', content: 'hi' },
    ]);
    expect(result).toEqual({ content: '{"ok":true}', model: 'gpt-test' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer k' }),
      })
    );
  });

  it('throws on non-json body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}, 'not-json'));
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: ApiMsg.AI_PROVIDER_INVALID_RESPONSE,
    });
  });

  it('throws with provider message on HTTP error', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, { error: { message: 'bad gateway' } }));
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toThrow(
      HttpException
    );
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: 'bad gateway',
    });
  });

  it('throws when choices content is empty', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: '  ' } }] }));
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: ApiMsg.AI_PROVIDER_EMPTY,
    });
  });

  it('wraps network errors', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: expect.stringContaining(ApiMsg.AI_PROVIDER_ERROR),
    });
  });

  it('uses fallback status message when error body has no message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, {}));
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: 'LLM request failed (403)',
    });
  });

  it('falls back to request model when response omits model', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { choices: [{ message: { content: '{"a":1}' } }] }));
    const result = await chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'requested' }, []);
    expect(result.model).toBe('requested');
  });

  it('treats an empty body as an empty completion', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: jest.fn().mockResolvedValue('') });
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: ApiMsg.AI_PROVIDER_EMPTY,
    });
  });

  it('stringifies non-error failures', async () => {
    fetchMock.mockRejectedValue('socket hangup');
    await expect(chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [])).rejects.toMatchObject({
      response: expect.stringContaining('socket hangup'),
    });
  });

  it('aborts the request when the timeout fires', async () => {
    jest.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) => {
        return new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
      });
      const pending = chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', timeoutMs: 25 }, []);
      jest.advanceTimersByTime(25);
      await expect(pending).rejects.toMatchObject({
        response: expect.stringContaining(ApiMsg.AI_PROVIDER_ERROR),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('still completes when AbortController is unavailable', async () => {
    const original = global.AbortController;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (global as any).AbortController;
    fetchMock.mockResolvedValue(jsonResponse(200, { model: 'm', choices: [{ message: { content: '{"ok":true}' } }] }));
    try {
      await expect(
        chatCompletionsJson({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm', timeoutMs: 20 }, [])
      ).resolves.toEqual({ content: '{"ok":true}', model: 'm' });
    } finally {
      global.AbortController = original;
    }
  });

  function streamResponse(chunks: string[], status = 200) {
    const encoder = new TextEncoder();
    let index = 0;
    return {
      ok: status >= 200 && status < 300,
      status,
      body: {
        getReader() {
          return {
            read: async () => {
              if (index >= chunks.length) return { done: true, value: undefined };
              const value = encoder.encode(chunks[index]);
              index += 1;
              return { done: false, value };
            },
          };
        },
      },
      text: jest.fn().mockResolvedValue(chunks.join('')),
    };
  }

  it('yields streamed deltas then done', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'data: {"model":"gpt-stream","choices":[{"delta":{"content":"Hel"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    );

    const events = [];
    for await (const event of chatCompletionsStream({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [
      { role: 'user', content: 'hi' },
    ])) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Hel' },
      { type: 'delta', text: 'lo' },
      { type: 'done', model: 'gpt-stream' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://x/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stream":true'),
      })
    );
  });

  it('yields reasoning_content as thinking events', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        'data: {"model":"r1","choices":[{"delta":{"reasoning_content":"plan"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
        'data: [DONE]\n\n',
      ])
    );

    const events = [];
    for await (const event of chatCompletionsStream({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, [
      { role: 'user', content: 'hi' },
    ])) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'thinking', text: 'plan' },
      { type: 'delta', text: 'ok' },
      { type: 'done', model: 'r1' },
    ]);
  });

  it('throws when stream has no content deltas', async () => {
    fetchMock.mockResolvedValue(streamResponse(['data: {"choices":[{"delta":{}}]}\n\n', 'data: [DONE]\n\n']));
    const iter = chatCompletionsStream({ apiKey: 'k', baseUrl: 'https://x/v1', model: 'm' }, []);
    await expect(iter.next()).rejects.toMatchObject({ response: ApiMsg.AI_PROVIDER_EMPTY });
  });
});
