import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { prepareAiAssistConfigForStorage, redactAiAssistConfig, resolveAiAssistConfig } from './ai-config';
import { aiSecretHint, decryptAiSecret, encryptAiSecret, loadAiSecretKey } from './ai-secret';

describe('AI secret storage', () => {
  const previous = process.env.REACTPRESS_AI_SECRET;

  beforeAll(() => {
    process.env.REACTPRESS_AI_SECRET = 'unit-test-ai-secret';
  });

  afterAll(() => {
    if (previous === undefined) delete process.env.REACTPRESS_AI_SECRET;
    else process.env.REACTPRESS_AI_SECRET = previous;
  });

  it('encrypts and decrypts a key', () => {
    const encrypted = encryptAiSecret('sk-test-key-1234');
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(decryptAiSecret(encrypted)).toBe('sk-test-key-1234');
  });

  it('leaves an already encrypted value unchanged', () => {
    const encrypted = encryptAiSecret('sk-test-key-1234');
    expect(encryptAiSecret(encrypted)).toBe(encrypted);
  });

  it('keeps a blank form field from wiping the saved key', () => {
    const stored = prepareAiAssistConfigForStorage(
      { enabled: true, apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
      { apiKey: 'sk-test-key-1234' }
    );
    expect(String(stored.apiKey).startsWith('enc:v1:')).toBe(true);
    expect(resolveAiAssistConfig(stored).apiKey).toBe('sk-test-key-1234');
  });

  it('redacts the key for admin responses', () => {
    const stored = prepareAiAssistConfigForStorage({ apiKey: 'sk-test-key-1234' }, undefined);
    const redacted = redactAiAssistConfig(stored);
    expect(redacted?.apiKey).toBe('');
    expect(redacted?.apiKeyConfigured).toBe(true);
    expect(redacted?.apiKeyHint).toBe('1234');
  });

  it('creates and reloads a file-backed key when the env secret is unset', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-ai-secret-'));
    const previousCwd = process.env.REACTPRESS_ORIGINAL_CWD;
    delete process.env.REACTPRESS_AI_SECRET;
    process.env.REACTPRESS_ORIGINAL_CWD = dir;
    try {
      const created = loadAiSecretKey();
      expect(created).toHaveLength(32);
      const file = path.join(dir, '.reactpress', 'ai-secret');
      expect(fs.readFileSync(file).subarray(0, 32).equals(created)).toBe(true);
      expect(loadAiSecretKey().equals(created)).toBe(true);
    } finally {
      process.env.REACTPRESS_AI_SECRET = 'unit-test-ai-secret';
      if (previousCwd === undefined) delete process.env.REACTPRESS_ORIGINAL_CWD;
      else process.env.REACTPRESS_ORIGINAL_CWD = previousCwd;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('replaces a short key file and ignores chmod failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rp-ai-secret-'));
    const previousCwd = process.env.REACTPRESS_ORIGINAL_CWD;
    delete process.env.REACTPRESS_AI_SECRET;
    process.env.REACTPRESS_ORIGINAL_CWD = dir;
    const file = path.join(dir, '.reactpress', 'ai-secret');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, Buffer.from('short'));
    jest.spyOn(fs, 'chmodSync').mockImplementation(() => {
      throw new Error('EPERM');
    });
    try {
      const created = loadAiSecretKey();
      expect(created).toHaveLength(32);
      expect(fs.readFileSync(file).length).toBeGreaterThanOrEqual(32);
    } finally {
      jest.restoreAllMocks();
      process.env.REACTPRESS_AI_SECRET = 'unit-test-ai-secret';
      if (previousCwd === undefined) delete process.env.REACTPRESS_ORIGINAL_CWD;
      else process.env.REACTPRESS_ORIGINAL_CWD = previousCwd;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('hides a hint when the stored secret cannot be decrypted', () => {
    const encrypted = encryptAiSecret('sk-test-key-1234');
    process.env.REACTPRESS_AI_SECRET = 'different-secret';
    try {
      expect(aiSecretHint(encrypted)).toEqual({ configured: false, hint: '' });
    } finally {
      process.env.REACTPRESS_AI_SECRET = 'unit-test-ai-secret';
    }
  });
});
