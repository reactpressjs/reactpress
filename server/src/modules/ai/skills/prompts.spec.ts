import { buildSkillMessages } from './prompts';
import type { AiSkillRunInput } from './types';

const baseArticle: NonNullable<AiSkillRunInput['article']> = {
  id: '1',
  title: 'Title',
  content: 'Body',
  summary: 'Sum',
  slug: 'title',
  seoKeywords: 'kw',
  seoDescription: 'desc',
};

describe('buildSkillMessages', () => {
  it('builds write messages with brief and defaults', () => {
    const msgs = buildSkillMessages({
      skillId: 'write',
      brief: '  Topic  ',
      audience: ' devs ',
      language: ' en ',
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('en');
    expect(msgs[0].content).toContain('devs');
    expect(msgs[1].content).toContain('Topic');
  });

  it('uses untitled topic when brief is empty on write', () => {
    const msgs = buildSkillMessages({ skillId: 'write' });
    expect(msgs[1].content).toContain('Untitled topic');
  });

  it.each(['organize', 'polish', 'pre-review'] as const)('serializes article for %s', (skillId) => {
    const msgs = buildSkillMessages({ skillId, article: baseArticle, brief: 'note' });
    expect(msgs[1].content).toContain('Title');
    expect(msgs[1].content).toContain('Body');
  });

  it('falls back to generic schema for unexpected skill id at runtime', () => {
    const msgs = buildSkillMessages({ skillId: 'bogus' as AiSkillRunInput['skillId'] });
    expect(msgs[0].content).toContain('fields');
    expect(msgs[1].content).toContain('title');
  });
});
