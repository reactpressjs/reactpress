let projectCwd: string | undefined;

export function setProjectCwd(cwd?: string): void {
  projectCwd = cwd ? cwd : undefined;
}
