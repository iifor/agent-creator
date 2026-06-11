import path from 'node:path';
import { pathExists, readText, writeFileEnsured } from '../utils/fs.js';
import { assertSafeName, toCamelCase, toKebabCase } from '../utils/string.js';
import { logger } from '../utils/logger.js';

export async function addGuardCommand(guardName: string): Promise<void> {
  assertSafeName(guardName);
  if (!(await pathExists('agent.config.ts')) || !(await pathExists('src/guards/index.ts'))) {
    throw new Error('agent add guard must be run from a generated Agent project root.');
  }

  const fileName = toKebabCase(guardName);
  const symbolName = `${toCamelCase(guardName)}Guard`;
  const target = path.join(process.cwd(), 'src/guards', `${fileName}.ts`);
  if (await pathExists(target)) throw new Error(`Guard already exists: src/guards/${fileName}.ts`);

  await writeFileEnsured(target, guardFile(symbolName, fileName));
  await updateGuardsIndex(fileName, symbolName, fileName);
  await updateAgentConfig(fileName);
  logger.success(`Added guard ${fileName}.`);
}

function guardFile(symbolName: string, guardName: string): string {
  return `import type { Guard } from '@agent-creator/core';

// Guard purpose: keep this Agent inside its intended domain and block unsafe requests early.
// Common checks: required user/session metadata, sensitive operations, forbidden terms, or compliance rules.
export const ${symbolName}: Guard = {
  async check(context) {
    const input = context.input.input.trim();
    if (!input) {
      return { allowed: false, reason: 'Input is required.' };
    }

    const blockedPatterns: RegExp[] = [
      // Add domain-specific block patterns for ${guardName}.
      // /delete\\s+all/i,
    ];
    if (blockedPatterns.some((pattern) => pattern.test(input))) {
      return { allowed: false, reason: 'Request is outside the allowed domain policy.' };
    }

    return { allowed: true };
  },
};
`;
}

async function updateGuardsIndex(fileName: string, symbolName: string, guardName: string): Promise<void> {
  const indexPath = path.join(process.cwd(), 'src/guards/index.ts');
  let text = await readText(indexPath);
  text = `import { ${symbolName} } from './${fileName}.js';\n${text}`;
  text = text.replace('// agent-creator:guard-imports', `// agent-creator:guard-imports\n  ${symbolName},`);
  text = text.replace('// agent-creator:guard-exports', `// agent-creator:guard-exports\n  '${guardName}',`);
  await writeFileEnsured(indexPath, text);
}

async function updateAgentConfig(guardName: string): Promise<void> {
  const configPath = path.join(process.cwd(), 'agent.config.ts');
  let text = await readText(configPath);
  text = text.replace('// agent-creator:guards', `// agent-creator:guards\n      '${guardName}',`);
  await writeFileEnsured(configPath, text);
}
