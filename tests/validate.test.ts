import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCommand } from '../src/commands/create.js';
import { validateCommand } from '../src/commands/validate.js';

describe('validate command', () => {
  afterEach(() => {
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

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
      process.chdir(previous);
    }
  });

  it('fails when generated config does not match schema', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { template: 'tool-agent', packageManager: 'npm' });
      const projectDir = path.join(dir, 'demo-agent');
      await fs.writeFile(path.join(projectDir, 'agent.config.ts'), 'export default { template: "bad-agent" };\n', 'utf8');
      process.chdir(projectDir);
      await validateCommand();
      expect(process.exitCode).toBe(1);
      expect(errorSpy.mock.calls.flat().join('\n')).toContain('agent.config.ts');
    } finally {
      process.chdir(previous);
    }
  });

  it('fails when generated config version is unsupported', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { template: 'tool-agent', packageManager: 'npm' });
      const projectDir = path.join(dir, 'demo-agent');
      const configPath = path.join(projectDir, 'agent.config.ts');
      const config = await fs.readFile(configPath, 'utf8');
      await fs.writeFile(configPath, config.replace("configVersion: '0.1'", "configVersion: '9.9'"), 'utf8');
      process.chdir(projectDir);
      await validateCommand();
      expect(process.exitCode).toBe(1);
      expect(errorSpy.mock.calls.flat().join('\n')).toContain('Unsupported configVersion');
    } finally {
      process.chdir(previous);
    }
  });
});
