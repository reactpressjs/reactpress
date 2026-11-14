import { getPreviewDraft, putPreviewDraft } from './preview-draft.store';

describe('preview-draft.store', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores and retrieves a draft by token', () => {
    const token = putPreviewDraft({
      themeId: 'hello-world',
      mods: { primaryColor: '#111' },
      configuration: { foo: 'bar' },
    });
    expect(token).toHaveLength(32);
    const draft = getPreviewDraft(token);
    expect(draft).toMatchObject({
      themeId: 'hello-world',
      mods: { primaryColor: '#111' },
      configuration: { foo: 'bar' },
    });
  });

  it('returns null for empty or unknown tokens', () => {
    expect(getPreviewDraft('')).toBeNull();
    expect(getPreviewDraft('   ')).toBeNull();
    expect(getPreviewDraft('deadbeef')).toBeNull();
  });

  it('expires drafts after TTL', () => {
    const token = putPreviewDraft({ themeId: 't1' });
    jest.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(getPreviewDraft(token)).toBeNull();
  });

  it('prunes expired entries on put', () => {
    const token = putPreviewDraft({ themeId: 'old' });
    jest.advanceTimersByTime(31 * 60 * 1000);
    putPreviewDraft({ themeId: 'new' });
    expect(getPreviewDraft(token)).toBeNull();
  });

  it('deletes a draft that expires after prune', () => {
    const token = putPreviewDraft({ themeId: 'race' });
    const createdAt = new Date('2025-01-01T00:00:00.000Z').getTime();
    let reads = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      reads += 1;
      return reads === 1 ? createdAt : createdAt + 30 * 60 * 1000 + 1;
    });
    expect(getPreviewDraft(token)).toBeNull();
    expect(getPreviewDraft(token)).toBeNull();
  });
});
