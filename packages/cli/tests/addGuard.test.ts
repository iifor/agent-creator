import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addGuardCommand } from '../src/commands/addGuard.js';
import { createCommand } from '../src/commands/create.js';

describe('add guard command', () => {
  it('adds and registers a generated guard', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-guard-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addGuardCommand('domain-policy');

      await expect(fs.access('src/guards/domain-policy.ts')).resolves.toBeUndefined();
      expect(await fs.readFile('src/guards/index.ts', 'utf8')).toContain('domainPolicyGuard');
      expect(await fs.readFile('src/guards/index.ts', 'utf8')).toContain("'domain-policy'");
      expect(await fs.readFile('agent.config.ts', 'utf8')).toContain("'domain-policy'");
    } finally {
      process.chdir(previous);
    }
  });

  it('rejects duplicate guard files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-guard-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addGuardCommand('domain-policy');

      await expect(addGuardCommand('domain-policy')).rejects.toThrow('Guard already exists');
    } finally {
      process.chdir(previous);
    }
  });
});
