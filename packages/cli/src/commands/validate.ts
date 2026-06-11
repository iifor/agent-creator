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
    'src/index.ts',
    'src/skills/index.ts',
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
    } else {
      if (configResult.config.service.enabled && configResult.config.service.framework !== 'next') {
        issues.push({
          location: 'agent.config.ts:service',
          reason: 'Generated service-enabled projects must use Next.js.',
          fix: "Set service.framework to 'next' or set service.enabled to false for package mode.",
        });
      }
      if (configResult.config.service.enabled) {
        await validateServiceProject(cwd, issues);
      }
    }

    const configText = await readText(configPath);
    const enabledSkills = configResult.config?.skills.enabled ?? extractEnabledSkills(configText);
    const enabledGuards = configResult.config?.guards?.enabled ?? extractNamedList(configText, 'guards');
    const enabledWorkflows = configResult.config?.workflows?.enabled ?? extractNamedList(configText, 'workflows');
    const skillsIndex = await pathExists(path.join(cwd, 'src/skills/index.ts'))
      ? await readText(path.join(cwd, 'src/skills/index.ts'))
      : '';
    const guardsIndex = await pathExists(path.join(cwd, 'src/guards/index.ts'))
      ? await readText(path.join(cwd, 'src/guards/index.ts'))
      : '';
    validateUniqueNames('skill', enabledSkills, issues);
    validateUniqueNames('guard', enabledGuards, issues);
    validateUniqueNames('workflow', enabledWorkflows, issues);

    const workflowSet = new Set(enabledWorkflows);
    for (const skill of enabledSkills) {
      if (!skillsIndex.includes(`'${skill}'`)) {
        issues.push({
          location: 'agent.config.ts',
          reason: `Enabled skill "${skill}" is not registered in src/skills/index.ts.`,
          fix: 'Register the skill with agent add skill or remove it from skills.enabled.',
        });
      }
      const skillFile = `src/skills/${skillFileName(skill)}.ts`;
      if (!workflowSet.has(skill) && !(await pathExists(path.join(cwd, skillFile)))) {
        issues.push({
          location: skillFile,
          reason: `Enabled skill "${skill}" does not have a matching Skill file.`,
          fix: `Restore ${skillFile}, run agent add skill ${skill.replace(/\./g, '-')}, or remove it from skills.enabled.`,
        });
      }
    }
    for (const guard of enabledGuards) {
      if (!guardsIndex.includes(`'${guard}'`)) {
        issues.push({
          location: 'agent.config.ts',
          reason: `Enabled guard "${guard}" is not registered in src/guards/index.ts.`,
          fix: 'Register the guard with agent add guard or remove it from guards.enabled.',
        });
      }
      const guardFile = `src/guards/${guard}.ts`;
      if (!(await pathExists(path.join(cwd, guardFile)))) {
        issues.push({
          location: guardFile,
          reason: `Enabled guard "${guard}" does not have a matching Guard file.`,
          fix: `Restore ${guardFile}, run agent add guard ${guard}, or remove it from guards.enabled.`,
        });
      }
    }
    for (const workflow of enabledWorkflows) {
      if (!skillsIndex.includes(`'${workflow}'`)) {
        issues.push({
          location: 'agent.config.ts',
          reason: `Enabled workflow "${workflow}" is not registered in src/skills/index.ts.`,
          fix: 'Register the workflow with agent add workflow or remove it from workflows.enabled.',
        });
      }
      const workflowFile = `src/skills/${skillFileName(workflow)}-workflow.ts`;
      if (!(await pathExists(path.join(cwd, workflowFile)))) {
        issues.push({
          location: workflowFile,
          reason: `Enabled workflow "${workflow}" does not have a matching workflow Skill file.`,
          fix: `Restore ${workflowFile}, run agent add workflow ${workflow.replace(/\./g, '-')}, or remove it from workflows.enabled.`,
        });
      }
    }

    await validateCoreDependency(cwd, issues);
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

async function validateServiceProject(cwd: string, issues: ValidationIssue[]): Promise<void> {
  const required = [
    'src/app/page.tsx',
    'src/app/api/agent/route.ts',
    'src/app/api/agent/auth.ts',
    'src/app/api/agent/health/route.ts',
    'src/components/AgentChat.tsx',
    'docs/api.md',
  ];

  for (const file of required) {
    if (!(await pathExists(path.join(cwd, file)))) {
      issues.push({ location: file, reason: 'Required service file is missing.', fix: `Restore ${file} from the agent-core capability.` });
    }
  }

  const packagePath = path.join(cwd, 'package.json');
  if (!(await pathExists(packagePath))) return;
  const packageJson = JSON.parse(await readText(packagePath)) as { dependencies?: Record<string, string> };
  const dependencies = packageJson.dependencies ?? {};
  for (const dependency of ['next', 'react', 'react-dom', 'antd', '@ant-design/nextjs-registry']) {
    if (!dependencies[dependency]) {
      issues.push({
        location: 'package.json',
        reason: `Generated service Agent requires dependency "${dependency}".`,
        fix: `Add ${dependency} to dependencies.`,
      });
    }
  }
}

async function validateCoreDependency(cwd: string, issues: ValidationIssue[]): Promise<void> {
  const packagePath = path.join(cwd, 'package.json');
  if (!(await pathExists(packagePath))) return;
  const packageJson = JSON.parse(await readText(packagePath)) as { dependencies?: Record<string, string> };
  if (!packageJson.dependencies?.['@agent-creator/core']) {
    issues.push({
      location: 'package.json',
      reason: 'Generated Agent requires @agent-creator/core.',
      fix: 'Add @agent-creator/core to dependencies.',
    });
  }
}

function extractEnabledSkills(configText: string): string[] {
  return extractNamedList(configText, 'skills');
}

function extractNamedList(configText: string, key: string): string[] {
  const match = configText.match(new RegExp(`${key}:\\s*{[\\s\\S]*?enabled:\\s*\\[([\\s\\S]*?)\\]`, 'm'));
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function validateUniqueNames(kind: 'skill' | 'guard' | 'workflow', names: string[], issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) duplicates.add(name);
    seen.add(name);
  }
  for (const duplicate of duplicates) {
    issues.push({
      location: `agent.config.ts:${kind}s.enabled`,
      reason: `Duplicate enabled ${kind} "${duplicate}".`,
      fix: `Keep one "${duplicate}" entry in ${kind}s.enabled and remove the duplicate entries.`,
    });
  }
}

function skillFileName(name: string): string {
  return name.replace(/\.run$/, '').replace(/\./g, '-');
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
