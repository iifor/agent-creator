import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCommand } from '../src/commands/create.js';
import { validateCommand } from '../src/commands/validate.js';

describe('validate command', () => {
  it('passes a generated project', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { template: 'tool-agent', packageManager: 'npm' });
      process.chdir(path.join(dir, 'demo-agent'));
      await validateCommand();
      expect(process.exitCode).not.toBe(1);
    } finally {
      process.exitCode = undefined;
      spy.mockRestore();
      process.chdir(previous);
    }
  });
});
