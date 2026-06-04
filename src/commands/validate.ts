import path from 'node:path';
import { pathExists, readText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

interface ValidationIssue {
  location: string;
  reason: string;
  fix: string;
}

export async function validateCommand(): Promise<void> {
  const cwd = process.cwd();
  const issues: ValidationIssue[] = [];
  const required = [
    'agent.config.ts',
    'package.json',
    'src/agent/orchestrator.ts',
    'src/agent/toolRegistry.ts',
    'src/tools/index.ts',
    'src/schemas/output.schema.ts',
  ];

  for (const file of required) {
    if (!(await pathExists(path.join(cwd, file)))) {
      issues.push({ location: file, reason: 'Required file is missing.', fix: `Restore or regenerate ${file}.` });
    }
  }

  const configPath = path.join(cwd, 'agent.config.ts');
  if (await pathExists(configPath)) {
    const configText = await readText(configPath);
    for (const tool of extractEnabledTools(configText)) {
      const toolFile = tool.split('.')[0];
      if (!(await pathExists(path.join(cwd, 'src/tools', `${toolFile}.ts`)))) {
        issues.push({
          location: 'agent.config.ts',
          reason: `Enabled tool "${tool}" does not have a matching src/tools/${toolFile}.ts file.`,
          fix: 'Create the tool with agent add tool or remove it from tools.enabled.',
        });
      }
    }
    if (!configText.includes("template: 'tool-agent'")) {
      issues.push({ location: 'agent.config.ts', reason: 'template must be tool-agent.', fix: "Set template: 'tool-agent'." });
    }
  }

  if (issues.length > 0) {
    logger.error('Agent project validation failed:');
    for (const issue of issues) {
      logger.error(`- ${issue.location}: ${issue.reason} Fix: ${issue.fix}`);
    }
    process.exitCode = 1;
    return;
  }

  logger.success('Agent project validation passed.');
}

function extractEnabledTools(configText: string): string[] {
  const match = configText.match(/enabled:\s*\[([\s\S]*?)\]/m);
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}
