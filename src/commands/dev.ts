import { spawn } from 'node:child_process';
import { pathExists } from '../utils/fs.js';

export async function devCommand(): Promise<void> {
  if (!(await pathExists('src/dev.ts'))) {
    throw new Error('agent dev must be run from a generated Agent project root.');
  }
  const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    process.exitCode = code ?? 0;
  });
}
