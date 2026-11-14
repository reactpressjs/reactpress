import { AI_SKILL_IDS, isAiSkillId } from './types';

describe('skills/types', () => {
  it('lists all skill ids', () => {
    expect(AI_SKILL_IDS).toEqual(['write', 'organize', 'polish', 'pre-review']);
  });

  it('validates skill ids', () => {
    expect(isAiSkillId('write')).toBe(true);
    expect(isAiSkillId('organize')).toBe(true);
    expect(isAiSkillId('polish')).toBe(true);
    expect(isAiSkillId('pre-review')).toBe(true);
    expect(isAiSkillId('unknown')).toBe(false);
    expect(isAiSkillId('')).toBe(false);
  });
});
