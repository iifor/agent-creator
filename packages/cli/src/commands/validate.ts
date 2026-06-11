import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
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

type ValidationCheck = 'structure' | 'security' | 'env' | 'runtime';

export async function validateCommand(check: ValidationCheck | string = 'structure'): Promise<void> {
  if (!['structure', 'security', 'env', 'runtime'].includes(check)) {
    throw new Error(`Unsupported validation check "${check}". Use structure, security, env, or runtime.`);
  }
  if (check !== 'structure') {
    await runFocusedValidation(check as Exclude<ValidationCheck, 'structure'>);
    return;
  }
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

async function runFocusedValidation(check: Exclude<ValidationCheck, 'structure'>): Promise<void> {
  const cwd = process.cwd();
  const issues: ValidationIssue[] = [];
  const configPath = path.join(cwd, 'agent.config.ts');
  if (!(await pathExists(configPath))) {
    issues.push({
      location: 'agent.config.ts',
      reason: 'Required file is missing.',
      fix: 'Run validation from a generated Agent project root.',
    });
  } else {
    const configResult = await loadAndValidateConfig(configPath);
    if (!configResult.config) {
      issues.push(...configResult.issues);
    } else if (check === 'security') {
      await validateSecurity(cwd, configResult.config, issues);
    } else if (check === 'env') {
      validateEnvironment(configResult.config, issues);
    } else {
      await validateRuntime(cwd, issues);
    }
  }
  reportValidation(check, issues);
}

async function validateSecurity(cwd: string, config: AgentConfigShape, issues: ValidationIssue[]): Promise<void> {
  const indexPath = path.join(cwd, 'src/index.ts');
  const indexText = await pathExists(indexPath) ? await readText(indexPath) : '';
  if (!indexText.includes("runtimeMode: process.env.NODE_ENV === 'production'")) {
    issues.push({
      location: 'src/index.ts',
      reason: 'Runtime mode is not derived from NODE_ENV.',
      fix: 'Pass runtimeMode to createAgent and select production when NODE_ENV=production.',
    });
  }
  if (!hasMethodCall(indexText, 'useMemory')) {
    issues.push({
      location: 'src/index.ts',
      reason: 'No explicit persistent MemoryProvider is registered for production.',
      fix: 'Register a persistent MemoryProvider with builder.useMemory(...).',
    });
  }

  const skillSources = await readDirectorySources(path.join(cwd, 'src/skills'));
  const hasExternalSkill = skillSources.some((source) =>
    /permission:\s*['"]external_api['"]/.test(source) || source.includes('createWebhookSkill('));
  if (hasExternalSkill && !hasMethodCall(indexText, 'useSkillAuthorizer')) {
    issues.push({
      location: 'src/index.ts',
      reason: 'An external_api Skill is registered without an application SkillAuthorizer.',
      fix: 'Register builder.useSkillAuthorizer(...) with an explicit allow policy.',
    });
  }

  if (config.service.enabled) {
    const authPath = path.join(cwd, 'src/app/api/agent/auth.ts');
    const authText = await pathExists(authPath) ? await readText(authPath) : '';
    if (
      !authText.includes('AGENT_API_KEY')
      || !authText.includes("process.env.NODE_ENV !== 'production'")
      || !authText.includes('status: 503')
    ) {
      issues.push({
        location: 'src/app/api/agent/auth.ts',
        reason: 'Production API authentication is not fail-closed.',
        fix: 'Restore the generated production AGENT_API_KEY enforcement.',
      });
    }
  }
}

function hasMethodCall(source: string, methodName: string): boolean {
  const sourceFile = ts.createSourceFile('src/index.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node)
      && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === methodName
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function validateEnvironment(config: AgentConfigShape, issues: ValidationIssue[]): void {
  if (!config.model.baseUrl.trim()) {
    issues.push({
      location: 'LLM_BASE_URL',
      reason: 'Model base URL is not configured.',
      fix: 'Set LLM_BASE_URL or a static model.baseUrl.',
    });
  }
  if (!config.model.apiKey.trim()) {
    issues.push({
      location: 'OPENAI_API_KEY',
      reason: 'Model API key is not configured.',
      fix: 'Set OPENAI_API_KEY or a static model.apiKey.',
    });
  }
  if (config.service.enabled && !process.env.AGENT_API_KEY?.trim()) {
    issues.push({
      location: 'AGENT_API_KEY',
      reason: 'Production service authentication key is not configured.',
      fix: 'Set AGENT_API_KEY to a strong deployment secret.',
    });
  }
}

async function validateRuntime(cwd: string, issues: ValidationIssue[]): Promise<void> {
  const tsxCli = path.join(cwd, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (!(await pathExists(tsxCli))) {
    issues.push({
      location: 'node_modules/tsx',
      reason: 'Runtime validation requires installed project dependencies.',
      fix: 'Install dependencies, then rerun agent validate runtime.',
    });
    return;
  }

  const scriptPath = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'agent-runtime-check-')), 'check.mjs');
  const entryUrl = pathToFileURL(path.join(cwd, 'src/index.ts')).href;
  await fs.writeFile(scriptPath, `import { getAgent } from ${JSON.stringify(entryUrl)};\ngetAgent();\n`, 'utf8');
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', scriptPath], {
      cwd,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        LLM_BASE_URL: process.env.LLM_BASE_URL || 'https://runtime-validation.invalid/v1',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'runtime-validation-key',
      },
    });
    if (result.status !== 0) {
      issues.push({
        location: 'src/index.ts',
        reason: `Agent runtime build failed: ${(result.stderr || result.stdout).trim()}`,
        fix: 'Repair generated module registration or runtime configuration.',
      });
    }
  } finally {
    await fs.rm(path.dirname(scriptPath), { recursive: true, force: true });
  }
}

function reportValidation(check: ValidationCheck, issues: ValidationIssue[]): void {
  if (issues.length > 0) {
    logger.error(`Agent project ${check} validation failed:`);
    for (const issue of issues) {
      logger.error(`- ${issue.location}: ${issue.reason} Fix: ${issue.fix}`);
    }
    process.exitCode = 1;
    return;
  }
  logger.success(`Agent project ${check} validation passed.`);
}

async function readDirectorySources(directory: string): Promise<string[]> {
  if (!(await pathExists(directory))) return [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const sources = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return readDirectorySources(entryPath);
    return entry.name.endsWith('.ts') ? [await readText(entryPath)] : [];
  }));
  return sources.flat();
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
  const sourceFile = ts.createSourceFile(configPath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const variables = new Map<string, ts.Expression>();
  let defaultExport: ts.Expression | undefined;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause?.isTypeOnly) throw unsupportedStaticConfig(statement);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) throw unsupportedStaticConfig(declaration);
        variables.set(declaration.name.text, declaration.initializer);
      }
    } else if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      defaultExport = statement.expression;
    } else if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement) && !ts.isEmptyStatement(statement)) {
      throw unsupportedStaticConfig(statement);
    }
  }
  if (!defaultExport) throw new Error('Static config requires a default export.');
  for (const initializer of variables.values()) evaluateStaticExpression(initializer, variables);
  return evaluateStaticExpression(defaultExport, variables);
}

function evaluateStaticExpression(expression: ts.Expression, variables: Map<string, ts.Expression>): unknown {
  if (ts.isParenthesizedExpression(expression)) return evaluateStaticExpression(expression.expression, variables);
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression)) {
    return evaluateStaticExpression(expression.expression, variables);
  }
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (expression.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isIdentifier(expression)) {
    if (expression.text === 'undefined') return undefined;
    const initializer = variables.get(expression.text);
    if (!initializer) throw unsupportedStaticConfig(expression);
    return evaluateStaticExpression(initializer, variables);
  }
  if (ts.isPrefixUnaryExpression(expression) && expression.operator === ts.SyntaxKind.MinusToken) {
    const value = evaluateStaticExpression(expression.operand, variables);
    if (typeof value === 'number') return -value;
    throw unsupportedStaticConfig(expression);
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return expression.elements.map((element) => {
      if (ts.isSpreadElement(element)) throw unsupportedStaticConfig(element);
      return evaluateStaticExpression(element, variables);
    });
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const result: Record<string, unknown> = {};
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) {
        throw unsupportedStaticConfig(property);
      }
      const name = propertyName(property.name);
      result[name] = evaluateStaticExpression(property.initializer, variables);
    }
    return result;
  }
  if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
    const left = evaluateStaticExpression(expression.left, variables);
    return left ?? evaluateStaticExpression(expression.right, variables);
  }
  if (isProcessEnvAccess(expression)) {
    return process.env[expression.name.text];
  }
  throw unsupportedStaticConfig(expression);
}

function isProcessEnvAccess(expression: ts.Expression): expression is ts.PropertyAccessExpression & { name: ts.Identifier } {
  return ts.isPropertyAccessExpression(expression)
    && ts.isIdentifier(expression.name)
    && ts.isPropertyAccessExpression(expression.expression)
    && ts.isIdentifier(expression.expression.expression)
    && expression.expression.expression.text === 'process'
    && expression.expression.name.text === 'env';
}

function propertyName(name: ts.PropertyName): string {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  throw unsupportedStaticConfig(name);
}

function unsupportedStaticConfig(node: ts.Node): Error {
  return new Error(`Unsupported executable or dynamic config syntax: ${node.getText()}. Use literals or process.env.NAME ?? fallback.`);
}
