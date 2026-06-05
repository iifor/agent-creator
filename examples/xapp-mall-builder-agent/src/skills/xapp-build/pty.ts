import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export interface PtyRule {
  name: string;
  test: RegExp;
  respond(buffer: string): string | null | undefined;
  once?: boolean;
}

export interface PtyDriveOptions {
  cwd: string;
  env?: NodeJS.ProcessEnv;
  timeout?: number;
  rules?: PtyRule[];
  onData?: (chunk: string) => void;
}

export interface PtyDriveResult {
  code: number;
  signal?: number;
  aborted?: string | null;
}

const require = createRequire(import.meta.url);
const ansi = /\x1b\[[0-9;?]*[ -/]*[@-~]/g;

export function stripAnsi(value: string): string {
  return value.replace(ansi, '');
}

export async function drive(command: string, args: string[], options: PtyDriveOptions): Promise<PtyDriveResult> {
  ensureSpawnHelperExecutable();
  const pty = require('node-pty') as typeof import('node-pty');
  const { cwd, env = process.env, timeout = 600000, rules = [], onData = () => undefined } = options;

  return new Promise((resolve, reject) => {
    const child = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd,
      env,
    });

    let buffer = '';
    const firedOnce = new Set<string>();
    let idleTimer: NodeJS.Timeout | undefined;
    let killTimer: NodeJS.Timeout | undefined;
    let aborted: string | null = null;

    const resetKillTimer = () => {
      if (killTimer) clearTimeout(killTimer);
      killTimer = setTimeout(() => {
        aborted = 'timeout';
        child.kill();
      }, timeout);
    };

    const evaluate = () => {
      for (const rule of rules) {
        if (rule.once && firedOnce.has(rule.name)) continue;
        if (!rule.test.test(buffer)) continue;
        let response: string | null | undefined;
        try {
          response = rule.respond(buffer);
        } catch (error) {
          aborted = `rule:${rule.name}:${error instanceof Error ? error.message : String(error)}`;
          child.kill();
          return;
        }
        if (response === null || response === undefined) {
          aborted = `need:${rule.name}`;
          child.kill();
          return;
        }
        if (rule.once) firedOnce.add(rule.name);
        child.write(response);
        buffer = '';
        return;
      }
    };

    const scheduleEvaluate = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(evaluate, 180);
    };

    child.onData((data) => {
      onData(data);
      buffer += stripAnsi(data);
      if (buffer.length > 8000) buffer = buffer.slice(-8000);
      resetKillTimer();
      scheduleEvaluate();
    });

    child.onExit(({ exitCode, signal }) => {
      if (idleTimer) clearTimeout(idleTimer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ code: exitCode, signal, aborted });
    });

    resetKillTimer();
    void reject;
  });
}

function ensureSpawnHelperExecutable(): void {
  if (process.platform === 'win32') return;
  try {
    const root = path.dirname(require.resolve('node-pty/package.json'));
    const helper = path.join(root, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
    if (!fs.existsSync(helper)) return;
    const mode = fs.statSync(helper).mode;
    if (!(mode & 0o111)) fs.chmodSync(helper, mode | 0o755);
  } catch {
    // node-pty will throw a clearer error if loading fails.
  }
}
