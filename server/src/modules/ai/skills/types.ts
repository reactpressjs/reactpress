export type AiSkillId = 'write' | 'organize' | 'polish' | 'pre-review';

/** Structured article fields Skills may propose. Never includes publish status. */
export interface AiArticleDraftFields {
  title?: string;
  content?: string;
  summary?: string;
  slug?: string;
  seoKeywords?: string;
  seoDescription?: string;
  /** Tag labels (not IDs) */
  tags?: string[];
  /** Category label (not ID) */
  category?: string;
}

export interface AiSkillResult {
  fields: AiArticleDraftFields;
  notes?: string;
}

export interface AiSkillRunInput {
  skillId: AiSkillId;
  brief?: string;
  audience?: string;
  language?: string;
  article?: {
    id?: string;
    title?: string;
    content?: string;
    summary?: string;
    slug?: string;
    seoKeywords?: string;
    seoDescription?: string;
  };
}

export const AI_SKILL_IDS: AiSkillId[] = ['write', 'organize', 'polish', 'pre-review'];

export function isAiSkillId(value: string): value is AiSkillId {
  return (AI_SKILL_IDS as string[]).includes(value);
}
