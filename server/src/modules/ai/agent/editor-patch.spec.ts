import {
  extractAgentEditorPatch,
  hasAgentEditorPatchMarker,
  parseAgentEditorPatch,
  stripAgentPatchFence,
} from './editor-patch';

describe('agent editor-patch', () => {
  it('parses a title-only patch', () => {
    const markdown = [
      'Updated the title.',
      '',
      '```reactpress-editor-patch',
      '{"title":"Clear new title"}',
      '```',
    ].join('\n');

    expect(parseAgentEditorPatch(markdown)).toEqual({ title: 'Clear new title' });
    expect(stripAgentPatchFence(markdown)).toBe('Updated the title.');
  });

  it('parses content that contains nested Markdown code fences', () => {
    const body = [
      '# Plugin intro',
      '',
      '```jsx',
      "function estimateMinutes(markdown = '') {",
      '  return 1;',
      '}',
      '```',
      '',
      'A few constraints keep plugins maintainable.',
    ].join('\n');
    const patch = {
      title: 'ReactPress plugins for frontend developers',
      content: body,
    };
    const markdown = [
      'Updated the editor with an introduction.',
      '',
      '```reactpress-editor-patch',
      JSON.stringify(patch),
      '```',
    ].join('\n');

    const parsed = parseAgentEditorPatch(markdown);
    expect(parsed).toEqual(patch);
    expect(parsed?.content).toContain('```jsx');
    expect(parsed?.content).toContain('estimateMinutes');
    expect(stripAgentPatchFence(markdown)).toBe('Updated the editor with an introduction.');
  });

  it('does not treat a nested ``` inside JSON as the fence closer', () => {
    const markdown = [
      'Done.',
      '```reactpress-editor-patch',
      '{"content":"# T\\n\\n```js\\nconst x = 1;\\n```\\n\\nMore"}',
      '```',
    ].join('\n');

    const extracted = extractAgentEditorPatch(markdown);
    expect(extracted).not.toBeNull();
    expect(JSON.parse(extracted!.jsonText)).toEqual({
      content: '# T\n\n```js\nconst x = 1;\n```\n\nMore',
    });
  });

  it('returns null for a truncated fence marker without falling apart', () => {
    const markdown = 'Thinking…\n```reactpress-editor-patch\n{"title":"Hi"';
    expect(hasAgentEditorPatchMarker(markdown)).toBe(true);
    expect(parseAgentEditorPatch(markdown)).toBeNull();
    expect(stripAgentPatchFence(markdown)).toBe('Thinking…');
  });

  it('ignores non-string field values', () => {
    const markdown = ['```reactpress-editor-patch', '{"title":"Ok","tags":["a"]}', '```'].join('\n');
    expect(parseAgentEditorPatch(markdown)).toEqual({ title: 'Ok' });
  });
});
