import path from 'node:path';

export function resolveProjectPath(name: string, cwd = process.cwd()): string {
  return path.resolve(cwd, name);
}

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}
