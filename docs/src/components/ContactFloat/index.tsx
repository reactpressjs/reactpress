import Translate, { translate } from '@docusaurus/Translate';
import useBaseUrl from '@docusaurus/useBaseUrl';
import React, { useEffect, useId, useState } from 'react';

import styles from './styles.module.css';

const X_URL = 'https://x.com/reactpre';
const EMAIL = 'admin@gaoredu.com';

function WeChatIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.934 2.005-6.408C11.543 8.236 9.66 7.03 8.691 7.03zm-3.24 4.387a.88.88 0 110-1.76.88.88 0 010 1.76zm4.64 0a.88.88 0 110-1.76.88.88 0 010 1.76z" />
      <path d="M15.312 9.978c-4.1 0-7.426 2.708-7.426 6.041 0 1.85 1.006 3.51 2.575 4.64a.49.49 0 01.178.555l-.335 1.237a.303.303 0 00-.04.178c0 .136.11.246.246.246a.28.28 0 00.14-.045l1.59-.93a.72.72 0 01.598-.082 8.48 8.48 0 002.37.337c4.1 0 7.426-2.708 7.426-6.041s-3.325-6.136-7.322-6.136zm-2.178 4.003a.734.734 0 110-1.468.734.734 0 010 1.468zm4.356 0a.734.734 0 110-1.468.734.734 0 010 1.468z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.743l7.727-8.833L1.254 2.25H8.08l4.253 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ContactFloat(): React.JSX.Element {
  const [wechatPinned, setWechatPinned] = useState(false);
  const panelId = useId();
  const qrSrc = useBaseUrl('/img/wechat.png');

  useEffect(() => {
    if (!wechatPinned) {
      return undefined;
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.(`.${styles.item}`)) {
        return;
      }
      setWechatPinned(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [wechatPinned]);

  const wechatLabel = translate({
    id: 'contact.float.wechat',
    message: 'WeChat',
    description: 'Contact float WeChat button label',
  });
  const xLabel = translate({
    id: 'contact.float.x',
    message: 'X (Twitter)',
    description: 'Contact float X button label',
  });
  const emailLabel = translate({
    id: 'contact.float.email',
    message: 'Email',
    description: 'Contact float email button label',
  });
  const qrAlt = translate({
    id: 'contact.float.wechatQrAlt',
    message: 'Scan to follow ReactPress on WeChat',
    description: 'Alt text for WeChat QR code',
  });

  return (
    <aside
      className={styles.rail}
      aria-label={translate({
        id: 'contact.float.aria',
        message: 'Contact ReactPress',
        description: 'Accessible label for the floating contact rail',
      })}
    >
      <div className={`${styles.item} ${wechatPinned ? styles.itemPinned : ''}`}>
        <button
          type="button"
          className={styles.button}
          aria-expanded={wechatPinned}
          aria-controls={panelId}
          aria-label={wechatLabel}
          onClick={() => setWechatPinned((open) => !open)}
        >
          <WeChatIcon />
          <span className={styles.label}>
            <Translate id="contact.float.wechat">WeChat</Translate>
          </span>
        </button>
        <div id={panelId} className={styles.popover} role="tooltip">
          <img className={styles.qr} src={qrSrc} alt={qrAlt} width={160} height={146} />
          <p className={styles.popoverHint}>
            <Translate id="contact.float.wechatHint">Scan with WeChat</Translate>
          </p>
        </div>
      </div>

      <a className={styles.button} href={X_URL} target="_blank" rel="noopener noreferrer" aria-label={xLabel}>
        <XIcon />
        <span className={styles.label}>
          <Translate id="contact.float.x">X</Translate>
        </span>
      </a>

      <a className={styles.button} href={`mailto:${EMAIL}`} aria-label={`${emailLabel}: ${EMAIL}`}>
        <MailIcon />
        <span className={styles.label}>
          <Translate id="contact.float.email">Email</Translate>
        </span>
      </a>
    </aside>
  );
}
