import { useEffect, useMemo, useState } from 'react';

import { resolveApiBaseUrl } from '@reactpressjs/reactpress-toolkit/plugin/react';

type LocaleMessages = Record<string, unknown>;

const FALLBACKS: Record<string, string> = {
  panelTitle: 'AI Assist',
  panelHint: 'Skills update the draft only. Publish requires human approval under All Posts → Pending review.',
  organize: 'Fill SEO & tags',
  polish: 'Polish',
  preReview: 'Pre-review',
  skillApplied: 'Skill applied to editor fields. Save when ready.',
  preReviewDone: 'Pre-review complete. Open All Posts → Pending review to approve publish.',
  saveDraftFirst: 'Save the draft first so AI can read the article.',
};

function readNestedMessage(messages: LocaleMessages, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = messages;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function detectLocale(): string {
  if (typeof document === 'undefined') return 'en';
  const lang = document.documentElement.lang || navigator.language || 'en';
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

async function fetchPluginLocale(pluginId: string, locale: string): Promise<LocaleMessages> {
  const base = (await resolveApiBaseUrl('/api')).replace(/\/$/, '');
  const token = (() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state?: { tokens?: { accessToken?: string } } };
      return parsed.state?.tokens?.accessToken ?? null;
    } catch {
      return null;
    }
  })();
  const res = await fetch(
    `${base}/extension/plugins/${encodeURIComponent(pluginId)}/locales/${encodeURIComponent(locale)}`,
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  if (!res.ok) return {};
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text) as { data?: { messages?: LocaleMessages } };
    return body.data?.messages ?? {};
  } catch {
    return {};
  }
}

/** Resolve AI Assist admin copy from plugin locales (`ai.*`). */
export function useAiAssistText(pluginId = 'ai-assist') {
  const locale = detectLocale();
  const [messages, setMessages] = useState<LocaleMessages>({});

  useEffect(() => {
    let cancelled = false;
    void fetchPluginLocale(pluginId, locale).then((next) => {
      if (!cancelled) setMessages(next);
    });
    return () => {
      cancelled = true;
    };
  }, [locale, pluginId]);

  return useMemo(() => (key: string) => readNestedMessage(messages, `ai.${key}`) ?? FALLBACKS[key] ?? key, [messages]);
}
