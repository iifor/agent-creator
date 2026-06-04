import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCommand } from '../src/commands/create.js';

describe('create command', () => {
  it('creates a tool-agent project', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { template: 'tool-agent', packageManager: 'npm' });
      await expect(fs.access(path.join(dir, 'demo-agent', 'agent.config.ts'))).resolves.toBeUndefined();
      await expect(fs.access(path.join(dir, 'demo-agent', 'src/agent/orchestrator.ts'))).resolves.toBeUndefined();
    } finally {
      process.chdir(previous);
    }
  });
});
