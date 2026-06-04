import path from 'node:path';
import { AddToolOptions } from '../types/cli.js';
import { pathExists, readText, writeFileEnsured } from '../utils/fs.js';
import { assertSafeName, toCamelCase, toKebabCase, toToolName } from '../utils/string.js';
import { logger } from '../utils/logger.js';

const permissions = ['public', 'external_api', 'user_private'];

export async function addToolCommand(toolName: string, options: AddToolOptions): Promise<void> {
  assertSafeName(toolName);
  const permission = options.permission ?? 'public';
  if (!permissions.includes(permission)) throw new Error(`Invalid permission: ${permission}`);
  if (!(await pathExists('agent.config.ts')) || !(await pathExists('src/tools/index.ts'))) {
    throw new Error('agent add tool must be run from a generated Agent project root.');
  }

  const fileName = toKebabCase(toolName);
  const symbolName = `${toCamelCase(toolName)}Tool`;
  const dottedName = toToolName(toolName);
  const target = path.join(process.cwd(), 'src/tools', `${fileName}.ts`);
  if (await pathExists(target)) throw new Error(`Tool already exists: src/tools/${fileName}.ts`);

  await writeFileEnsured(target, toolFile(symbolName, dottedName, permission));
  await updateToolsIndex(fileName, symbolName, dottedName);
  await updateAgentConfig(dottedName);
  logger.success(`Added tool ${dottedName}.`);
}

function toolFile(symbolName: string, dottedName: string, permission: string): string {
  return `import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

const inputSchema = z.object({
  query: z.string().min(1),
});

const outputSchema = z.object({
  ok: z.boolean(),
  result: z.string(),
});

export const ${symbolName}: ToolDefinition = {
  name: '${dottedName}',
  description: 'Generated tool skeleton.',
  inputSchema,
  outputSchema,
  permission: '${permission}' as const,
  timeoutMs: 5000,
  retry: 1,
  async handler(input) {
    const value = inputSchema.parse(input);
    return { ok: true, result: \`Handled \${value.query}\` };
  },
};
`;
}

async function updateToolsIndex(fileName: string, symbolName: string, dottedName: string): Promise<void> {
  const indexPath = path.join(process.cwd(), 'src/tools/index.ts');
  let text = await readText(indexPath);
  text = `export { ${symbolName} } from './${fileName}.js';\n${text}`;
  text = text.replace('// agent-creator:tool-exports', `// agent-creator:tool-exports\n  '${dottedName}',`);
  await writeFileEnsured(indexPath, text);
}

async function updateAgentConfig(dottedName: string): Promise<void> {
  const configPath = path.join(process.cwd(), 'agent.config.ts');
  let text = await readText(configPath);
  text = text.replace('// agent-creator:tools', `// agent-creator:tools\n      '${dottedName}',`);
  await writeFileEnsured(configPath, text);
}
