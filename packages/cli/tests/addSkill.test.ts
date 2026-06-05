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
});
