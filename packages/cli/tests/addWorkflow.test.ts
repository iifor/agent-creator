import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addWorkflowCommand } from '../src/commands/addWorkflow.js';
import { createCommand } from '../src/commands/create.js';

describe('add workflow command', () => {
  it('adds and registers a generated workflow skill', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-workflow-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addWorkflowCommand('customer-onboarding');

      await expect(fs.access('src/skills/customer-onboarding-workflow.ts')).resolves.toBeUndefined();
      const skillsIndex = await fs.readFile('src/skills/index.ts', 'utf8');
      expect(skillsIndex).toContain('customerOnboardingWorkflow');
      expect(skillsIndex).toContain("'customer.onboarding'");
      expect(await fs.readFile('agent.config.ts', 'utf8')).toContain("'customer.onboarding'");
      const workflow = await fs.readFile('src/skills/customer-onboarding-workflow.ts', 'utf8');
      expect(workflow).toContain("tags: ['workflow']");
      expect(workflow).toContain("status: z.enum(['completed', 'skipped', 'failed'])");
      expect(workflow).toContain('failedSteps');
      expect(workflow).toContain('Workflow partially completed');
    } finally {
      process.chdir(previous);
    }
  });

  it('rejects duplicate workflow files', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-workflow-'));
    const previous = process.cwd();
    process.chdir(dir);
    try {
      await createCommand('demo-agent', { capability: 'agent-core', mode: 'package' });
      process.chdir(path.join(dir, 'demo-agent'));
      await addWorkflowCommand('customer-onboarding');

      await expect(addWorkflowCommand('customer-onboarding')).rejects.toThrow('Workflow already exists');
    } finally {
      process.chdir(previous);
    }
  });
});
