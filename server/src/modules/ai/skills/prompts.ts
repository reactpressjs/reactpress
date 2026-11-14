import type { AiSkillRunInput } from './types';

const FIELD_SCHEMA = `Return a single JSON object with this shape:
{
  "fields": {
    "title": string,
    "content": string (Markdown body),
    "summary": string (~120-160 chars, plain text),
    "slug": string (lowercase, hyphenated, ASCII preferred),
    "seoKeywords": string (comma-separated),
    "seoDescription": string (~150-160 chars),
    "tags": string[] (3-8 short labels),
    "category": string (one label)
  },
  "notes": string (optional checklist or rationale)
}
Only include fields you are changing. Never set publish status.`;

export function buildSkillMessages(input: AiSkillRunInput): Array<{ role: 'system' | 'user'; content: string }> {
  const language = input.language?.trim() || 'auto (match the user brief)';
  const audience = input.audience?.trim() || 'general readers';

  switch (input.skillId) {
    case 'write':
      return [
        {
          role: 'system',
          content: `You are ReactPress Blog AI. Write a complete blog post as Markdown with SEO metadata.
Prefer concrete titles. Use short paragraphs and ## / ### headings. Match language: ${language}.
Audience: ${audience}.
${FIELD_SCHEMA}`,
        },
        {
          role: 'user',
          content: `Write a post about:\n${input.brief?.trim() || 'Untitled topic'}`,
        },
      ];
    case 'organize':
      return [
        {
          role: 'system',
          content: `You are ReactPress Blog AI. Fill or improve SEO metadata, slug, summary, tags, and category for an existing draft. Keep the body unless a tiny summary tweak is needed.
${FIELD_SCHEMA}`,
        },
        {
          role: 'user',
          content: serializeArticle(input),
        },
      ];
    case 'polish':
      return [
        {
          role: 'system',
          content: `You are ReactPress Blog AI. Polish the draft: improve structure and clarity without changing meaning. Tighten summary and SEO when helpful.
${FIELD_SCHEMA}`,
        },
        {
          role: 'user',
          content: serializeArticle(input),
        },
      ];
    case 'pre-review':
      return [
        {
          role: 'system',
          content: `You are ReactPress Blog AI. Pre-review a draft before human publish approval.
Check: unique actionable slug, summary quality, seoDescription completeness, keyword relevance, missing sections, risky/unverifiable claims.
Return fields only for suggested fixes (may be empty). Put a clear checklist in "notes".
${FIELD_SCHEMA}`,
        },
        {
          role: 'user',
          content: serializeArticle(input),
        },
      ];
    default:
      return [
        {
          role: 'system',
          content: FIELD_SCHEMA,
        },
        {
          role: 'user',
          content: serializeArticle(input),
        },
      ];
  }
}

function serializeArticle(input: AiSkillRunInput): string {
  const a = input.article ?? {};
  return JSON.stringify(
    {
      title: a.title ?? '',
      content: a.content ?? '',
      summary: a.summary ?? '',
      slug: a.slug ?? '',
      seoKeywords: a.seoKeywords ?? '',
      seoDescription: a.seoDescription ?? '',
      brief: input.brief ?? '',
    },
    null,
    2
  );
}
