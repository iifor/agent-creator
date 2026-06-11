import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addSkillCommand } from '../src/commands/addSkill.js';
import { createCommand } from '../src/commands/create.js';

describe('add skill command', () => {
  it('adds and registers a generated skill', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-skill-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addSkillCommand('calendar');

      await expect(fs.access('src/skills/calendar.ts')).resolves.toBeUndefined();
      expect(await fs.readFile('src/skills/index.ts', 'utf8')).toContain('calendarSkill');
      expect(await fs.readFile('agent.config.ts', 'utf8')).toContain("'calendar.run'");
      const skill = await fs.readFile('src/skills/calendar.ts', 'utf8');
      expect(skill).toContain("permission: 'public'");
      expect(skill).toContain('timeoutMs: 30000');
    } finally {
      process.chdir(previous);
    }
  });

  it('supports hyphenated skill names', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-skill-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addSkillCommand('customer-search');

      await expect(fs.access('src/skills/customer-search.ts')).resolves.toBeUndefined();
      expect(await fs.readFile('src/skills/index.ts', 'utf8')).toContain("'customer.search'");
    } finally {
      process.chdir(previous);
    }
  });

  it('adds the built-in webhook skill adapter and env example', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-skill-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addSkillCommand('webhook');

      const webhook = await fs.readFile('src/skills/webhook.ts', 'utf8');
      expect(webhook).toContain("import { createWebhookSkill } from '@agent-creator/core';");
      expect(webhook).toContain('process.env.WEBHOOK_URL');
      expect(await fs.readFile('src/skills/index.ts', 'utf8')).toContain('webhookSkill');
      expect(await fs.readFile('src/skills/index.ts', 'utf8')).toContain("'webhook'");
      expect(await fs.readFile('agent.config.ts', 'utf8')).toContain("'webhook'");
      const envExample = await fs.readFile('.env.example', 'utf8');
      expect(envExample.match(/WEBHOOK_URL=/g)).toHaveLength(1);
    } finally {
      process.chdir(previous);
    }
  });
});
