import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { agentConfigSchema, type AgentConfigShape } from '../schemas/agentConfig.schema.js';
import { pathExists, readText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { SUPPORTED_CONFIG_VERSIONS } from '../version.js';

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
    const configResult = await loadAndValidateConfig(configPath);
    if (!configResult.config) {
      issues.push(...configResult.issues);
    } else if (!SUPPORTED_CONFIG_VERSIONS.includes(configResult.config.configVersion as never)) {
      issues.push({
        location: 'agent.config.ts:configVersion',
        reason: `Unsupported configVersion "${configResult.config.configVersion}".`,
        fix: `Use one of: ${SUPPORTED_CONFIG_VERSIONS.join(', ')}. Future versions may provide agent migrate.`,
      });
    }

    const enabledTools = configResult.config?.tools.enabled ?? extractEnabledTools(await readText(configPath));
    for (const tool of enabledTools) {
      const toolFile = tool.split('.')[0];
      if (!(await pathExists(path.join(cwd, 'src/tools', `${toolFile}.ts`)))) {
        issues.push({
          location: 'agent.config.ts',
          reason: `Enabled tool "${tool}" does not have a matching src/tools/${toolFile}.ts file.`,
          fix: 'Create the tool with agent add tool or remove it from tools.enabled.',
        });
      }
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

async function loadAndValidateConfig(configPath: string): Promise<{ config?: AgentConfigShape; issues: ValidationIssue[] }> {
  try {
    const loaded = await loadConfig(configPath);
    const parsed = agentConfigSchema.safeParse(loaded);
    if (parsed.success) return { config: parsed.data, issues: [] };

    return {
      issues: parsed.error.issues.map((issue) => ({
        location: `agent.config.ts:${issue.path.join('.') || 'default'}`,
        reason: issue.message,
        fix: 'Update agent.config.ts to match the AgentConfig schema documented in docs/generated-agent-runtime.md.',
      })),
    };
  } catch (error) {
    return {
      issues: [
        {
          location: 'agent.config.ts',
          reason: `Could not load config: ${error instanceof Error ? error.message : String(error)}`,
          fix: 'Run npm install in the generated project and make sure agent.config.ts has a valid default export.',
        },
      ],
    };
  }
}

async function loadConfig(configPath: string): Promise<unknown> {
  const source = await readText(configPath);
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: configPath,
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-config-'));
  const tempFile = path.join(tempDir, 'agent.config.mjs');
  await fs.writeFile(tempFile, transpiled.outputText, 'utf8');

  try {
    const imported = await import(`${pathToFileURL(tempFile).href}?t=${Date.now()}`);
    return imported.default;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
