import { resolveApiBaseUrl } from "@reactpressjs/reactpress-toolkit/plugin/react";

import { clearInvalidServerSession } from "@/shared/auth/session";
import { useAuthStore } from "@/stores/auth";
import { API_BASE_URL } from "@/utils/constants";

export type AiSkillId = "write" | "organize" | "polish" | "pre-review";

export interface AiStatus {
  pluginId: string;
  enabled: boolean;
  configured: boolean;
  model: string;
  baseUrl: string;
  skills: string[];
}

export interface AiArticleDraftFields {
  title?: string;
  content?: string;
  summary?: string;
  slug?: string;
  seoKeywords?: string;
  seoDescription?: string;
  tags?: string[];
  category?: string;
}

export interface AiReviewRow {
  id: string;
  articleId: string;
  skillId: string;
  status: string;
  notes?: string | null;
  model?: string | null;
  approvedBy?: number | null;
  proposed?: AiArticleDraftFields;
  current?: AiArticleDraftFields;
  articleTitle?: string;
  createAt?: string;
}

export interface AiSkillRunResult {
  skillId: string;
  model: string;
  fields: AiArticleDraftFields;
  notes?: string | null;
  article?: { id: string; title?: string; status?: string } | null;
  review?: AiReviewRow | null;
}

async function aiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = (await resolveApiBaseUrl(API_BASE_URL || "/api")).replace(/\/$/, "");
  const token = useAuthStore.getState().tokens?.accessToken;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await res.json()) as {
    success?: boolean;
    code?: number;
    data?: T;
    msg?: string;
    message?: string;
  };
  if (res.status === 401) {
    clearInvalidServerSession();
    throw new Error("SESSION_EXPIRED");
  }
  if (!res.ok) {
    throw new Error(body.msg ?? body.message ?? `Request failed: ${res.status}`);
  }
  if (typeof body.code === "number" && body.code !== 0) {
    throw new Error(body.message ?? "Request failed");
  }
  if (body.success === false) {
    throw new Error(body.msg ?? "Request failed");
  }
  return body.data as T;
}

export function fetchAiStatus() {
  return aiFetch<AiStatus>("/ai/status");
}

export function testAiConnection(body?: { apiKey?: string; baseUrl?: string; model?: string }) {
  return aiFetch<{ ok: boolean; model: string }>("/ai/test", {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function runAiSkill(body: {
  skillId: AiSkillId;
  brief?: string;
  audience?: string;
  language?: string;
  articleId?: string;
  createDraft?: boolean;
  enqueueReview?: boolean;
}) {
  return aiFetch<AiSkillRunResult>("/ai/skills/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchAiReviews(query?: { status?: string; page?: number; pageSize?: number }) {
  const params = new URLSearchParams();
  if (query?.status) params.set("status", query.status);
  if (query?.page) params.set("page", String(query.page));
  if (query?.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  return aiFetch<{ data: AiReviewRow[]; total: number; page: number; pageSize: number }>(
    `/ai/reviews${qs ? `?${qs}` : ""}`,
  );
}

export function fetchAiReview(id: string) {
  return aiFetch<AiReviewRow>(`/ai/reviews/${encodeURIComponent(id)}`);
}

export function approveAiReview(id: string, body?: { scheduledPublishAt?: string }) {
  return aiFetch<{ review: AiReviewRow; article: unknown; scheduledPublishAt?: string | null }>(
    `/ai/reviews/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    },
  );
}

export function rejectAiReview(id: string) {
  return aiFetch<AiReviewRow>(`/ai/reviews/${encodeURIComponent(id)}/reject`, {
    method: "POST",
  });
}

export type AiAgentChatRole = "user" | "assistant";

export interface AiAgentChatMessage {
  role: AiAgentChatRole;
  content: string;
}

/** Fields the Agent may patch into the left-side editor. */
export type AiAgentEditorContext = Pick<
  AiArticleDraftFields,
  "title" | "content" | "summary" | "slug" | "seoKeywords" | "seoDescription"
>;

export type AiAgentStreamEvent =
  | { type: "thinking"; text: string }
  | { type: "delta"; text: string }
  | { type: "done"; model: string }
  | { type: "error"; message: string };

export async function streamAiAgentChat(
  messages: AiAgentChatMessage[],
  handlers: {
    onEvent: (event: AiAgentStreamEvent) => void;
    signal?: AbortSignal;
    editorContext?: AiAgentEditorContext;
  },
): Promise<void> {
  const base = (await resolveApiBaseUrl(API_BASE_URL || "/api")).replace(/\/$/, "");
  const token = useAuthStore.getState().tokens?.accessToken;
  const res = await fetch(`${base}/ai/agent/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      messages,
      ...(handlers.editorContext ? { editorContext: handlers.editorContext } : {}),
    }),
    signal: handlers.signal,
  });

  if (res.status === 401) {
    clearInvalidServerSession();
    throw new Error("SESSION_EXPIRED");
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = (await res.json()) as { msg?: string; message?: string };
      message = body.msg ?? body.message ?? message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  if (!res.body) {
    throw new Error("Empty stream response");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  /** Yield so React can paint when a proxy delivers many SSE events in one TCP chunk. */
  const yieldForPaint = () =>
    new Promise<void>((resolve) => {
      if (typeof globalThis.setTimeout === "function") {
        globalThis.setTimeout(() => resolve(), 0);
        return;
      }
      resolve();
    });

  let streamDone = false;
  while (!streamDone) {
    const { done, value } = await reader.read();
    streamDone = done;
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as AiAgentStreamEvent;
        handlers.onEvent(event);
        if (event.type === "thinking" || event.type === "delta") {
          await yieldForPaint();
        }
      } catch {
        // skip malformed chunks
      }
    }
  }
}

export function createAiAgentDraft(body: { content: string; enqueueReview?: boolean }) {
  return aiFetch<{
    model: string;
    fields: AiArticleDraftFields;
    article: { id: string; title?: string; status?: string } | null;
    review: AiReviewRow | null;
  }>("/ai/agent/draft", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
