import type {
  ArticleEditorAdminSlotContext,
  PluginAdminSlotComponentProps,
} from '@reactpressjs/reactpress-toolkit/plugin/admin';
import { useState } from 'react';

import styles from './article-editor-ai-panel.module.css';
import { useAiAssistText } from './locale';

type Props = PluginAdminSlotComponentProps<ArticleEditorAdminSlotContext>;

type SkillId = 'organize' | 'polish' | 'pre-review';

function readAccessToken(): string {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return '';
    const parsed = JSON.parse(raw) as {
      state?: { tokens?: { accessToken?: string } };
    };
    return parsed.state?.tokens?.accessToken ?? '';
  } catch {
    return '';
  }
}

async function runSkillRequest(body: Record<string, unknown>) {
  const token = readAccessToken();
  const res = await fetch('/api/ai/skills/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      fields?: Record<string, string>;
      notes?: string | null;
    };
    msg?: string;
    message?: string;
  };
  if (!res.ok || json.success === false) {
    throw new Error(json.msg ?? json.message ?? `Skill failed (${res.status})`);
  }
  return json.data;
}

export function ArticleEditorAiPanel({ context, config }: Props) {
  const { articleId, draft, patch } = context;
  const t = useAiAssistText();
  const [busy, setBusy] = useState<SkillId | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);

  if (config.enabled === false) return null;

  const applyFields = (fields?: Record<string, string>) => {
    if (!fields) return;
    if (typeof fields.title === 'string') patch('title', fields.title);
    if (typeof fields.content === 'string') patch('content', fields.content);
    if (typeof fields.summary === 'string') patch('summary', fields.summary);
    if (typeof fields.slug === 'string') patch('slug', fields.slug);
    if (typeof fields.seoKeywords === 'string') patch('seoKeywords', fields.seoKeywords);
    if (typeof fields.seoDescription === 'string') patch('seoDescription', fields.seoDescription);
  };

  const onRun = async (skillId: SkillId) => {
    if (!articleId) {
      setMessage(t('saveDraftFirst'));
      return;
    }
    setBusy(skillId);
    setMessage(null);
    setNotes(null);
    try {
      const data = await runSkillRequest({
        skillId,
        articleId,
        enqueueReview: skillId === 'pre-review',
      });
      applyFields(data?.fields);
      if (data?.notes) setNotes(data.notes);
      setMessage(skillId === 'pre-review' ? t('preReviewDone') : t('skillApplied'));
      void draft;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <span className={styles.title}>{t('panelTitle')}</span>
      </header>
      <div className={styles.body}>
        <p className={styles.hint}>{t('panelHint')}</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            disabled={Boolean(busy)}
            onClick={() => void onRun('organize')}
          >
            {busy === 'organize' ? '…' : t('organize')}
          </button>
          <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => void onRun('polish')}>
            {busy === 'polish' ? '…' : t('polish')}
          </button>
          <button
            type="button"
            className={styles.buttonPrimary}
            disabled={Boolean(busy)}
            onClick={() => void onRun('pre-review')}
          >
            {busy === 'pre-review' ? '…' : t('preReview')}
          </button>
        </div>
        {message ? <p className={styles.message}>{message}</p> : null}
        {notes ? <pre className={styles.notes}>{notes}</pre> : null}
      </div>
    </section>
  );
}
