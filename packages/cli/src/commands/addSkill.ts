import path from 'node:path';
import type { AddToolOptions } from '../types/cli.js';
import { pathExists, readText, writeFileEnsured } from '../utils/fs.js';
import { assertSafeName, toCamelCase, toKebabCase, toToolName } from '../utils/string.js';
import { logger } from '../utils/logger.js';

export async function addSkillCommand(skillName: string, _options: AddToolOptions = {}): Promise<void> {
  assertSafeName(skillName);
  if (!(await pathExists('agent.config.ts')) || !(await pathExists('src/skills/index.ts'))) {
    throw new Error('agent add skill must be run from a generated Agent project root.');
  }

  const fileName = toKebabCase(skillName);
  const symbolName = `${toCamelCase(skillName)}Skill`;
  const isWebhookSkill = toKebabCase(skillName) === 'webhook';
  const dottedName = isWebhookSkill ? 'webhook' : toToolName(skillName);
  const target = path.join(process.cwd(), 'src/skills', `${fileName}.ts`);
  if (await pathExists(target)) throw new Error(`Skill already exists: src/skills/${fileName}.ts`);

  await writeFileEnsured(target, isWebhookSkill ? webhookSkillFile(symbolName) : skillFile(symbolName, dottedName));
  await updateSkillsIndex(fileName, symbolName, dottedName);
  await updateAgentConfig(dottedName);
  if (isWebhookSkill) await updateEnvExample();
  logger.success(`Added skill ${dottedName}.`);
}

function skillFile(symbolName: string, dottedName: string): string {
  return `import { z } from 'zod';
import type { Skill } from '@agent-creator/core';

// Call this skill directly by passing:
// metadata: { skill: '${dottedName}', skillInput: { query: '...' } }
const inputSchema = z.object({
  query: z.string().min(1),
});

const outputSchema = z.object({
  ok: z.boolean(),
  result: z.string(),
});

export const ${symbolName}: Skill<z.infer<typeof inputSchema>, z.infer<typeof outputSchema>> = {
  name: '${dottedName}',
  description: 'Generated skill skeleton.',
  inputSchema,
  outputSchema,
  async execute(input) {
    return { ok: true, result: \`Handled \${input.query}\` };
  },
};
`;
}

function webhookSkillFile(symbolName: string): string {
  return `import { createWebhookSkill } from '@agent-creator/core';

// Call this skill directly by passing:
// metadata: {
//   skill: 'webhook',
//   skillInput: { event: 'build.completed', message: 'Build finished' }
// }
export const ${symbolName} = createWebhookSkill({
  url: process.env.WEBHOOK_URL ?? '',
});
`;
}

async function updateSkillsIndex(fileName: string, symbolName: string, dottedName: string): Promise<void> {
  const indexPath = path.join(process.cwd(), 'src/skills/index.ts');
  let text = await readText(indexPath);
  text = `import { ${symbolName} } from './${fileName}.js';\n${text}`;
  text = text.replace('// agent-creator:skill-imports', `// agent-creator:skill-imports\n  ${symbolName},`);
  text = text.replace('// agent-creator:skill-exports', `// agent-creator:skill-exports\n  '${dottedName}',`);
  await writeFileEnsured(indexPath, text);
}

async function updateAgentConfig(dottedName: string): Promise<void> {
  const configPath = path.join(process.cwd(), 'agent.config.ts');
  let text = await readText(configPath);
  text = text.replace('// agent-creator:skills', `// agent-creator:skills\n      '${dottedName}',`);
  await writeFileEnsured(configPath, text);
}

async function updateEnvExample(): Promise<void> {
  const envPath = path.join(process.cwd(), '.env.example');
  if (!(await pathExists(envPath))) return;
  const text = await readText(envPath);
  if (text.includes('WEBHOOK_URL=')) return;
  const suffix = text.endsWith('\n') ? '' : '\n';
  await writeFileEnsured(envPath, `${text}${suffix}\n# Optional webhook target used by the webhook skill/runtime service.\nWEBHOOK_URL=\n`);
}
