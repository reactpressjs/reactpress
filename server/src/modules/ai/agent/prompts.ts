export type AgentChatRole = 'user' | 'assistant';

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
}

/** Snapshot of the left-side article editor fields for Agent edits. */
export interface AgentEditorContext {
  title?: string;
  content?: string;
  summary?: string;
  slug?: string;
  seoKeywords?: string;
  seoDescription?: string;
}

export const AGENT_EDITOR_PATCH_LANG = 'reactpress-editor-patch';

export const AGENT_SYSTEM_PROMPT = `You are the ReactPress writing Agent linked to the left-side article editor.
You ALWAYS receive the current editor draft in this system message (title, content, summary, slug, SEO). Treat that draft as the source of truth — do not pretend the editor is empty if content is shown below.

Match the user's language (Chinese or English).
Prefer concrete titles. Do not invent publish dates, view counts, or live URLs.

Field edits (title / content / summary / slug / seoKeywords / seoDescription):
- If the user asks to set or change a field to a specific value (e.g. "把标题改成 XXX" / "change the title to XXX"), apply it immediately.
- Do NOT ask whether they want a new article.
- Do NOT require body content before changing title, summary, slug, or SEO fields.
- Empty or placeholder body is fine; still patch the requested fields.
- Reply with one short confirmation sentence, then the patch block.

Full drafts / writing from a vague brief:
- When drafting a full post, use Markdown with clear structure.
- Ask at most one clarifying question only when the request itself is too vague to write anything (e.g. "帮我写一篇" with no topic). Never ask clarifying questions for explicit field edits.

Patch protocol — whenever the left editor should change:
1. Brief natural-language confirmation.
2. Append ONE fenced code block with language tag ${AGENT_EDITOR_PATCH_LANG} containing a JSON object of ONLY the fields that should change.
Allowed keys: title, content, summary, slug, seoKeywords, seoDescription.
Example for a title-only change:

\`\`\`${AGENT_EDITOR_PATCH_LANG}
{"title":"Clear new title"}
\`\`\`

For a full draft, put the Markdown body in "content" (without a leading H1 if "title" is set separately), and set "title".
The JSON must be valid: escape newlines as \\n and quotes as \\" inside string values. Markdown code fences inside "content" are fine — keep them inside the JSON string and close the ${AGENT_EDITOR_PATCH_LANG} fence only after the JSON object ends.
Never put the patch JSON outside that fence. Do not use ${AGENT_EDITOR_PATCH_LANG} for non-patch fences.
If you are only brainstorming and should not change the editor yet, omit the patch block.`;

const CONTENT_CONTEXT_MAX = 6_000;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

/** Build a system appendix with the current editor draft. */
export function buildAgentEditorContextPrompt(context: AgentEditorContext | undefined): string {
  if (!context || typeof context !== 'object') {
    return [
      'Current left-side editor draft:',
      '(no snapshot provided — still apply explicit field edits the user requests)',
    ].join('\n');
  }
  const title = String(context.title ?? '');
  const content = String(context.content ?? '');
  const summary = String(context.summary ?? '');
  const slug = String(context.slug ?? '');
  const seoKeywords = String(context.seoKeywords ?? '');
  const seoDescription = String(context.seoDescription ?? '');
  const hasAny = [title, content, summary, slug, seoKeywords, seoDescription].some((v) => v.trim());
  if (!hasAny) {
    return [
      'Current left-side editor draft: empty new article (title and body are blank).',
      'The user can still set title/summary/slug/SEO/content via patches. For an explicit title change, patch title only — do not ask for a topic first.',
    ].join('\n');
  }
  return [
    'Current left-side editor draft (source of truth for edits):',
    `title: ${title || '(empty)'}`,
    `slug: ${slug || '(empty)'}`,
    `summary: ${summary || '(empty)'}`,
    `seoKeywords: ${seoKeywords || '(empty)'}`,
    `seoDescription: ${seoDescription || '(empty)'}`,
    'content (Markdown):',
    truncate(content, CONTENT_CONTEXT_MAX) || '(empty)',
  ].join('\n');
}

/** Single system message: instructions + live editor snapshot (providers often keep only one system turn). */
export function buildAgentSystemMessage(editorContext?: AgentEditorContext): string {
  return `${AGENT_SYSTEM_PROMPT}\n\n---\n${buildAgentEditorContextPrompt(editorContext)}`;
}
