import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addGuardCommand } from '../src/commands/addGuard.js';
import { addSkillCommand } from '../src/commands/addSkill.js';
import { addWorkflowCommand } from '../src/commands/addWorkflow.js';
import { createCommand } from '../src/commands/create.js';

describe('generated project acceptance scaffolds', () => {
  it('registers Skill, Guard, and Workflow scaffolds together', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-acceptance-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addSkillCommand('calendar');
      await addGuardCommand('domain-policy');
      await addWorkflowCommand('customer-onboarding');

      const config = await fs.readFile('agent.config.ts', 'utf8');
      expect(config).toContain("'calendar.run'");
      expect(config).toContain("'domain-policy'");
      expect(config).toContain("'customer.onboarding'");

      const index = await fs.readFile('src/index.ts', 'utf8');
      expect(index).toContain('builder.useGuard(guard)');
      expect(index).toContain('export function invokeSkill');
      const client = await fs.readFile('src/client.ts', 'utf8');
      expect(client).toContain('Record<string, string>');
      const skillsIndex = await fs.readFile('src/skills/index.ts', 'utf8');
      expect(skillsIndex).toContain('calendarSkill');
      expect(skillsIndex).toContain('customerOnboardingWorkflow');
      expect(skillsIndex).toContain("'customer.onboarding'");
      const guardsIndex = await fs.readFile('src/guards/index.ts', 'utf8');
      expect(guardsIndex).toContain('domainPolicyGuard');
      expect(guardsIndex).toContain("'domain-policy'");
      expect(await fs.readFile('src/guards/domain-policy.ts', 'utf8')).toContain('const blockedPatterns: RegExp[]');

      const workflow = await fs.readFile('src/skills/customer-onboarding-workflow.ts', 'utf8');
      expect(workflow).toContain("tags: ['workflow']");
      expect(workflow).toContain('failedSteps');
      expect(workflow).toContain('steps: z.array(z.string().min(1)).min(1)');
    } finally {
      process.chdir(previous);
    }
  });
});
