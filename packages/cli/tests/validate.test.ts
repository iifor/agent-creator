import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addGuardCommand } from '../src/commands/addGuard.js';
import { addSkillCommand } from '../src/commands/addSkill.js';
import { addWorkflowCommand } from '../src/commands/addWorkflow.js';
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
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm' });
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
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm' });
      const projectDir = path.join(dir, 'demo-agent');
      await fs.writeFile(path.join(projectDir, 'agent.config.ts'), 'export default { capability: "bad-agent" };\n', 'utf8');
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
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm' });
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

  it('passes a package-mode generated project', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await validateCommand();
      expect(process.exitCode).not.toBe(1);
    } finally {
      process.chdir(previous);
    }
  });

  it('passes a generated project with registered guards and workflows', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addGuardCommand('domain-policy');
      await addWorkflowCommand('customer-onboarding');
      await validateCommand();
      expect(process.exitCode).not.toBe(1);
    } finally {
      process.chdir(previous);
    }
  });

  it('fails when enabled guard and workflow files are missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addGuardCommand('domain-policy');
      await addWorkflowCommand('customer-onboarding');
      await fs.rm(path.join(process.cwd(), 'src/guards/domain-policy.ts'));
      await fs.rm(path.join(process.cwd(), 'src/skills/customer-onboarding-workflow.ts'));

      await validateCommand();
      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain('src/guards/domain-policy.ts');
      expect(output).toContain('src/skills/customer-onboarding-workflow.ts');
    } finally {
      process.chdir(previous);
    }
  });

  it('fails when enabled Skill, Guard, or Workflow names are duplicated', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addSkillCommand('calendar');
      await addGuardCommand('domain-policy');
      await addWorkflowCommand('customer-onboarding');
      const configPath = path.join(process.cwd(), 'agent.config.ts');
      const config = await fs.readFile(configPath, 'utf8');
      await fs.writeFile(configPath, config
        .replace("'calendar.run',", "'calendar.run',\n      'calendar.run',")
        .replace("'domain-policy',", "'domain-policy',\n      'domain-policy',")
        .replace("// agent-creator:workflows\n      'customer.onboarding',", "// agent-creator:workflows\n      'customer.onboarding',\n      'customer.onboarding',"), 'utf8');

      await validateCommand();
      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Duplicate enabled skill "calendar.run"');
      expect(output).toContain('Duplicate enabled guard "domain-policy"');
      expect(output).toContain('Duplicate enabled workflow "customer.onboarding"');
    } finally {
      process.chdir(previous);
    }
  });

  it('fails when service framework is invalid for service projects', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm' });
      const projectDir = path.join(dir, 'demo-agent');
      const configPath = path.join(projectDir, 'agent.config.ts');
      const config = await fs.readFile(configPath, 'utf8');
      await fs.writeFile(configPath, config.replace("framework: 'next'", 'framework: undefined'), 'utf8');
      process.chdir(projectDir);
      await validateCommand();
      expect(process.exitCode).toBe(1);
      expect(errorSpy.mock.calls.flat().join('\n')).toContain('service-enabled projects must use Next.js');
    } finally {
      process.chdir(previous);
    }
  });

  it('fails when service integration files are missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-creator-'));
    const previous = process.cwd();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', packageManager: 'npm' });
      const projectDir = path.join(dir, 'demo-agent');
      await fs.rm(path.join(projectDir, 'src/app/api/agent/health/route.ts'));
      await fs.rm(path.join(projectDir, 'docs/api.md'));
      process.chdir(projectDir);
      await validateCommand();
      expect(process.exitCode).toBe(1);
      const output = errorSpy.mock.calls.flat().join('\n');
      expect(output).toContain('src/app/api/agent/health/route.ts');
      expect(output).toContain('docs/api.md');
    } finally {
      process.chdir(previous);
    }
  });
});
