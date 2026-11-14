import {
  DEFAULT_AI_ASSIST_CONFIG,
  prepareAiAssistConfigForStorage,
  redactAiAssistConfig,
  resolveAiAssistConfig,
} from './ai-config';
import { encryptAiSecret } from './ai-secret';

describe('ai-config', () => {
  const prevSecret = process.env.REACTPRESS_AI_SECRET;

  beforeAll(() => {
    process.env.REACTPRESS_AI_SECRET = 'unit-test-ai-config';
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.REACTPRESS_AI_SECRET;
    else process.env.REACTPRESS_AI_SECRET = prevSecret;
  });

  it('applies defaults when raw config is missing', () => {
    expect(resolveAiAssistConfig(undefined)).toEqual({
      enabled: true,
      apiKey: '',
      baseUrl: DEFAULT_AI_ASSIST_CONFIG.baseUrl,
      model: DEFAULT_AI_ASSIST_CONFIG.model,
    });
  });

  it('honors enabled=false and custom baseUrl/model', () => {
    const resolved = resolveAiAssistConfig({
      enabled: false,
      baseUrl: ' https://custom/v1 ',
      model: ' custom-model ',
      apiKey: encryptAiSecret('sk-test-1234'),
    });
    expect(resolved.enabled).toBe(false);
    expect(resolved.baseUrl).toBe('https://custom/v1');
    expect(resolved.model).toBe('custom-model');
    expect(resolved.apiKey).toBe('sk-test-1234');
  });

  it('falls back to defaults for blank baseUrl and model strings', () => {
    const resolved = resolveAiAssistConfig({ baseUrl: '  ', model: '', apiKey: '' });
    expect(resolved.baseUrl).toBe(DEFAULT_AI_ASSIST_CONFIG.baseUrl);
    expect(resolved.model).toBe(DEFAULT_AI_ASSIST_CONFIG.model);
  });

  it('redacts undefined config unchanged', () => {
    expect(redactAiAssistConfig(undefined)).toBeUndefined();
  });

  it('redacts configured key with hint', () => {
    const stored = prepareAiAssistConfigForStorage({ apiKey: 'sk-abcd-9999' }, undefined);
    const redacted = redactAiAssistConfig(stored);
    expect(redacted?.apiKey).toBe('');
    expect(redacted?.apiKeyConfigured).toBe(true);
    expect(redacted?.apiKeyHint).toBe('9999');
  });
});
