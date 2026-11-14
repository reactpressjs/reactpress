import { platform } from 'node:os';

export function isWindows(): boolean {
  return platform() === 'win32';
}

export function getDockerComposeCommand(): string {
  return isWindows() ? 'docker-compose.exe' : 'docker-compose';
}
