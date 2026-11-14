#!/usr/bin/env node
/**
 * Strip heavyweight artifacts before `npm pack` so the published tarball stays <10MB.
 * Runtime deps are installed via postinstall (install-bundled-runtime.mjs).
 */
import fs from 'fs';
import path from 'path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.join(__dirname, '..');

const REMOVE_DIRS = [
  'server/node_modules',
  'toolkit/node_modules',
  'server/logs',
  'server/.reactpress',
  'server/public/uploads',
  'server/dist/public',
];

const PRUNE_DIRS = ['out', 'dist', 'server/dist', 'toolkit/dist'];

function shouldPruneFile(name) {
  return name.endsWith('.map') || name.endsWith('.d.ts') || name.endsWith('.d.ts.map') || name.endsWith('.tsbuildinfo');
}

async function rmDir(rel) {
  const abs = path.join(cliRoot, rel);
  if (!fs.existsSync(abs)) return;
  let lastError;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      fs.rmSync(abs, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      console.log(`[prune-bundled-pack] removed ${rel}`);
      return;
    } catch (err) {
      lastError = err;
      await sleep(100 * (attempt + 1));
    }
  }
  throw lastError;
}

async function walkPrune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        await rmDir(path.relative(cliRoot, abs));
        continue;
      }
      await walkPrune(abs);
      continue;
    }
    if (shouldPruneFile(entry.name)) {
      fs.unlinkSync(abs);
    }
  }
}

async function main() {
  for (const rel of REMOVE_DIRS) {
    await rmDir(rel);
  }
  for (const rel of PRUNE_DIRS) {
    await walkPrune(path.join(cliRoot, rel));
  }
  console.log('[prune-bundled-pack] done');
}

main().catch((err) => {
  console.error('[prune-bundled-pack] failed:', err);
  process.exit(1);
});
