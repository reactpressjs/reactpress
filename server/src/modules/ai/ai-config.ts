import { aiSecretHint, decryptAiSecret, encryptAiSecret } from './ai-secret';

export const AI_ASSIST_PLUGIN_ID = 'ai-assist';

export interface AiAssistPluginConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const DEFAULT_AI_ASSIST_CONFIG: AiAssistPluginConfig = {
  enabled: true,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
};

export function resolveAiAssistConfig(raw: Record<string, unknown> | undefined): AiAssistPluginConfig {
  const patch = raw ?? {};
  const storedKey = typeof patch.apiKey === 'string' ? patch.apiKey.trim() : '';
  return {
    enabled: patch.enabled !== false,
    apiKey: storedKey ? decryptAiSecret(storedKey) : '',
    baseUrl:
      typeof patch.baseUrl === 'string' && patch.baseUrl.trim()
        ? patch.baseUrl.trim()
        : DEFAULT_AI_ASSIST_CONFIG.baseUrl,
    model: typeof patch.model === 'string' && patch.model.trim() ? patch.model.trim() : DEFAULT_AI_ASSIST_CONFIG.model,
  };
}

/** Persist a new key, or keep the previous ciphertext when the admin form leaves the field blank. */
export function prepareAiAssistConfigForStorage(
  incoming: Record<string, unknown>,
  previous: Record<string, unknown> | undefined
): Record<string, unknown> {
  const next = { ...incoming };
  delete next.apiKeyConfigured;
  delete next.apiKeyHint;
  const incomingKey = typeof next.apiKey === 'string' ? next.apiKey.trim() : '';
  const previousKey = typeof previous?.apiKey === 'string' ? previous.apiKey : '';
  if (!incomingKey) {
    next.apiKey = previousKey ? encryptAiSecret(previousKey) : '';
  } else {
    next.apiKey = encryptAiSecret(incomingKey);
  }
  return next;
}

/** Admin responses never include the raw or encrypted key. */
export function redactAiAssistConfig(config: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!config) return config;
  const stored = typeof config.apiKey === 'string' ? config.apiKey : '';
  const hint = aiSecretHint(stored);
  return {
    ...config,
    apiKey: '',
    apiKeyConfigured: hint.configured,
    apiKeyHint: hint.hint,
  };
}
