import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { resolveProjectRoot } from '../../utils/project-root.util';

const PREFIX = 'enc:v1:';

function secretFilePath(): string {
  return path.join(resolveProjectRoot(), '.reactpress', 'ai-secret');
}

/** 32-byte key from REACTPRESS_AI_SECRET, or a random key stored under .reactpress/. */
export function loadAiSecretKey(): Buffer {
  const fromEnv = process.env.REACTPRESS_AI_SECRET?.trim();
  if (fromEnv) {
    return createHash('sha256').update(fromEnv).digest();
  }

  const file = secretFilePath();
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file);
    if (raw.length >= 32) return raw.subarray(0, 32);
  }

  const key = randomBytes(32);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, key, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    // Windows may reject chmod; the file is still outside the repo via .reactpress/.
  }
  return key;
}

export function isEncryptedAiSecret(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptAiSecret(plain: string): string {
  const value = plain.trim();
  if (!value) return '';
  if (isEncryptedAiSecret(value)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', loadAiSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + toBase64Url(Buffer.concat([iv, tag, encrypted]));
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

export function decryptAiSecret(stored: string): string {
  const value = stored.trim();
  if (!value) return '';
  if (!isEncryptedAiSecret(value)) return value;

  const payload = fromBase64Url(value.slice(PREFIX.length));
  if (payload.length < 12 + 16) {
    throw new Error('AI_SECRET_DECRYPT_FAILED');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const data = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', loadAiSecretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function aiSecretHint(stored: string): { configured: boolean; hint: string } {
  if (!stored.trim()) return { configured: false, hint: '' };
  try {
    const plain = decryptAiSecret(stored);
    if (!plain) return { configured: false, hint: '' };
    return { configured: true, hint: plain.length > 4 ? plain.slice(-4) : '' };
  } catch {
    return { configured: false, hint: '' };
  }
}
