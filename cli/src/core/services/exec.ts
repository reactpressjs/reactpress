import { spawnSync } from 'node:child_process';

import { isWindows } from '../utils/platform';

export interface RunSyncResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export function runSync(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    silent?: boolean;
  } = {}
): RunSyncResult {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    shell: isWindows(),
    stdio: options.silent ? 'pipe' : 'inherit',
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').toString(),
    stderr: (result.stderr ?? '').toString(),
    code: result.status,
  };
}

export function isDockerAvailable(): boolean {
  const result = runSync('docker', ['info'], { silent: true });
  return result.ok;
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
