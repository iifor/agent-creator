import path from 'node:path';
import { pathExists, readText, writeFileEnsured } from '../utils/fs.js';
import { assertSafeName, toCamelCase, toKebabCase, toToolName } from '../utils/string.js';
import { logger } from '../utils/logger.js';

export async function addWorkflowCommand(workflowName: string): Promise<void> {
  assertSafeName(workflowName);
  if (!(await pathExists('agent.config.ts')) || !(await pathExists('src/skills/index.ts'))) {
    throw new Error('agent add workflow must be run from a generated Agent project root.');
  }

  const fileName = toKebabCase(workflowName);
  const symbolName = `${toCamelCase(workflowName)}Workflow`;
  const dottedName = toToolName(workflowName);
  const target = path.join(process.cwd(), 'src/skills', `${fileName}-workflow.ts`);
  if (await pathExists(target)) throw new Error(`Workflow already exists: src/skills/${fileName}-workflow.ts`);

  await writeFileEnsured(target, workflowFile(symbolName, dottedName));
  await updateSkillsIndex(`${fileName}-workflow`, symbolName, dottedName);
  await updateAgentConfig(dottedName);
  logger.success(`Added workflow ${dottedName}.`);
}

function workflowFile(symbolName: string, dottedName: string): string {
  return `import { z } from 'zod';
import type { Skill } from '@agent-creator/core';

// Workflows are modeled as Skills so the core runtime stays small.
// Call this workflow directly by passing:
// Trusted server code: agent.invokeSkill({ skill: '${dottedName}', input: { goal: '...', steps: ['...'] } })
const inputSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
});

const outputSchema = z.object({
  ok: z.boolean(),
  goal: z.string(),
  steps: z.array(z.object({
    step: z.string(),
    status: z.enum(['completed', 'skipped', 'failed']),
    note: z.string(),
  })),
  failedSteps: z.array(z.string()),
  summary: z.string(),
});

export const ${symbolName}: Skill<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  name: '${dottedName}',
  description: 'Generated workflow skill skeleton for multi-step domain work.',
  inputSchema,
  outputSchema,
  tags: ['workflow'],
  async execute(input, context) {
    const steps = [];
    const failedSteps: string[] = [];

    for (const step of input.steps) {
      try {
        // Replace this placeholder with explicit domain work or calls to shared services.
        steps.push({
          step,
          status: 'completed' as const,
          note: \`Handled step for trace \${context.traceId}.\`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failedSteps.push(step);
        steps.push({ step, status: 'failed' as const, note: message });
      }
    }

    const ok = failedSteps.length === 0;

    return {
      ok,
      goal: input.goal,
      steps,
      failedSteps,
      summary: ok
        ? \`Workflow completed \${steps.length} step(s) for: \${input.goal}\`
        : \`Workflow partially completed for: \${input.goal}. Failed step(s): \${failedSteps.join(', ')}\`,
    };
  },
};
`;
}

async function updateSkillsIndex(fileName: string, symbolName: string, dottedName: string): Promise<void> {
  const indexPath = path.join(process.cwd(), 'src/skills/index.ts');
  let text = await readText(indexPath);
  text = `import { ${symbolName} } from './${fileName}.js';\n${text}`;
  text = text.replace('// agent-creator:skill-imports', `// agent-creator:skill-imports\n  ${symbolName},`);
  text = text.replace('// agent-creator:skill-exports', `// agent-creator:skill-exports\n  '${dottedName}',`);
  text = text.replace('// agent-creator:workflow-exports', `// agent-creator:workflow-exports\n  '${dottedName}',`);
  await writeFileEnsured(indexPath, text);
}

async function updateAgentConfig(dottedName: string): Promise<void> {
  const configPath = path.join(process.cwd(), 'agent.config.ts');
  let text = await readText(configPath);
  text = text.replace('// agent-creator:skills', `// agent-creator:skills\n      '${dottedName}',`);
  text = text.replace('// agent-creator:workflows', `// agent-creator:workflows\n      '${dottedName}',`);
  await writeFileEnsured(configPath, text);
}
