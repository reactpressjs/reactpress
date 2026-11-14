/** Language tag for the Agent → editor machine patch fence. */
export const AGENT_EDITOR_PATCH_LANG = "reactpress-editor-patch";

export const PATCH_FIELD_KEYS = [
  "title",
  "content",
  "summary",
  "slug",
  "seoKeywords",
  "seoDescription",
] as const;

export type AgentPatchFieldKey = (typeof PATCH_FIELD_KEYS)[number];

export type AgentApplyPayload = Partial<Record<AgentPatchFieldKey, string>>;

const PATCH_FENCE_OPEN_RE = /```reactpress-editor-patch\b[^\n]*\r?\n/i;
/** Provider think tags: `<think>`, `<thinking>`, and redacted reasoning blocks. */
const THINK_BLOCK_RE =
  /<(?:think|thinking|redacted_reasoning)>([\s\S]*?)<\/(?:think|thinking|redacted_reasoning)>/gi;
const OPEN_THINK_RE = /<(?:think|thinking|redacted_reasoning)>([\s\S]*)$/i;

/**
 * Walk a JSON object literal and return the end index (exclusive).
 * Respects strings/escapes so nested Markdown fences inside `"content"` do not
 * truncate the patch (the old non-greedy ``` regex failed on that).
 */
export function findJsonObjectEnd(source: string, start: number): number {
  if (source[start] !== "{") return -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

export function hasAgentEditorPatchMarker(markdown: string): boolean {
  return PATCH_FENCE_OPEN_RE.test(markdown);
}

/**
 * Locate the first `reactpress-editor-patch` fence and return its JSON payload
 * plus the span to strip from the human-readable reply.
 */
export function extractAgentEditorPatch(markdown: string): {
  jsonText: string;
  fenceStart: number;
  fenceEnd: number;
} | null {
  const open = PATCH_FENCE_OPEN_RE.exec(markdown);
  if (!open) return null;

  const fenceStart = open.index;
  const bodyStart = fenceStart + open[0].length;
  const braceAt = markdown.indexOf("{", bodyStart);
  if (braceAt < 0 || /[^\s]/.test(markdown.slice(bodyStart, braceAt))) {
    return null;
  }

  const jsonEnd = findJsonObjectEnd(markdown, braceAt);
  if (jsonEnd < 0) return null;

  let fenceEnd = jsonEnd;
  const afterJson = markdown.slice(jsonEnd);
  const closeFence = afterJson.match(/^\s*```/);
  if (closeFence) {
    fenceEnd = jsonEnd + closeFence[0].length;
  }

  return {
    jsonText: markdown.slice(braceAt, jsonEnd),
    fenceStart,
    fenceEnd,
  };
}

/** Strip the machine patch fence so the bubble shows only human-readable text. */
export function stripAgentPatchFence(markdown: string): string {
  const extracted = extractAgentEditorPatch(markdown);
  if (extracted) {
    return `${markdown.slice(0, extracted.fenceStart)}${markdown.slice(extracted.fenceEnd)}`.trim();
  }
  // Hide an incomplete trailing fence while the reply is still streaming.
  return markdown.replace(/```reactpress-editor-patch\b[\s\S]*$/i, "").trim();
}

export function parseAgentEditorPatch(markdown: string): AgentApplyPayload | null {
  const extracted = extractAgentEditorPatch(markdown);
  if (!extracted) return null;
  try {
    const raw = JSON.parse(extracted.jsonText) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const patch: AgentApplyPayload = {};
    for (const key of PATCH_FIELD_KEYS) {
      if (typeof raw[key] === "string") {
        patch[key] = raw[key];
      }
    }
    return Object.keys(patch).length > 0 ? patch : null;
  } catch {
    return null;
  }
}

/** Split provider `<think>` tags into thinking + visible reply. */
export function splitAgentThinkContent(markdown: string): { thinking: string; content: string } {
  const thinkingParts: string[] = [];
  let content = markdown.replace(THINK_BLOCK_RE, (_match, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed) thinkingParts.push(trimmed);
    return "";
  });

  const openThink = content.match(OPEN_THINK_RE);
  if (openThink) {
    const partial = openThink[1]?.trim();
    if (partial) thinkingParts.push(partial);
    content = content.replace(OPEN_THINK_RE, "");
  }

  return {
    thinking: thinkingParts.join("\n\n").trim(),
    content: content.trim(),
  };
}

/** Legacy fallback: treat a full Markdown reply as title + body. */
export function parseAgentMarkdown(markdown: string): AgentApplyPayload {
  const text = stripAgentPatchFence(markdown).trim() || markdown.trim();
  const heading = text.match(/^#\s+(.+)$/m);
  const title = (heading?.[1] || text.split(/\r?\n/).find((line) => line.trim()) || "")
    .replace(/^#+\s*/, "")
    .trim()
    .slice(0, 120);
  const content = heading ? text.replace(/^#\s+.+\n?/, "").trim() : text;
  return {
    title: title || "Untitled",
    content: content || text,
  };
}
