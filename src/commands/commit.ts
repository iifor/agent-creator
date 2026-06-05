import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { logger } from '../utils/logger.js';

export const COMMIT_TYPES = [
  ['feat', 'new feature'],
  ['fix', 'bug fix'],
  ['hotfix', 'urgent production fix'],
  ['docs', 'documentation'],
  ['test', 'tests'],
  ['refactor', 'code refactor'],
  ['chore', 'maintenance'],
  ['build', 'build system'],
  ['ci', 'CI configuration'],
  ['perf', 'performance'],
  ['revert', 'revert a change'],
] as const;

type CommitType = (typeof COMMIT_TYPES)[number][0];

export interface CommitOptions {
  type?: string;
  scope?: string;
  message?: string;
  breaking?: boolean;
}

interface CommandResult {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: Error;
}

interface CommitDependencies {
  question?: (prompt: string) => Promise<string>;
  run?: (command: string, args: string[]) => CommandResult;
}

export async function commitCommand(options: CommitOptions, dependencies: CommitDependencies = {}): Promise<void> {
  const run = dependencies.run ?? runCommand;
  const repoCheck = run('git', ['rev-parse', '--is-inside-work-tree']);
  if (repoCheck.status !== 0) {
    throw new Error('agent commit must be run inside a Git repository.');
  }

  const stagedCheck = run('git', ['diff', '--cached', '--quiet']);
  if (stagedCheck.status === 0) {
    throw new Error('No staged changes found. Run git add first.');
  }
  if (stagedCheck.status !== 1) {
    throw new Error(commandError('Could not inspect staged changes.', stagedCheck));
  }

  const needsPrompt = !options.type || !options.message;
  const rl = needsPrompt && !dependencies.question
    ? readline.createInterface({ input: stdin, output: stdout })
    : undefined;
  const question = dependencies.question ?? ((prompt: string) => rl!.question(prompt));

  try {
    const type = options.type ? validateCommitType(options.type) : await promptCommitType(question);
    const scope = options.scope ?? (needsPrompt ? await question('Scope (optional): ') : '');
    const message = options.message ?? await question('Description: ');
    const commitMessage = buildCommitMessage(type, scope, message, options.breaking ?? false);
    const result = run('git', ['commit', '-m', commitMessage]);

    if (result.status !== 0) {
      throw new Error(commandError('Git commit failed.', result));
    }

    if (result.stdout?.trim()) logger.info(result.stdout.trim());
    logger.success(`Committed: ${commitMessage}`);
  } finally {
    rl?.close();
  }
}

export function buildCommitMessage(type: string, scope: string | undefined, message: string, breaking = false): string {
  const validType = validateCommitType(type);
  const normalizedScope = scope?.trim();
  const normalizedMessage = message.trim();

  if (normalizedScope && !/^[a-z0-9._-]+$/.test(normalizedScope)) {
    throw new Error('Commit scope may only contain lowercase letters, numbers, ".", "_", and "-".');
  }
  if (!normalizedMessage || /[\r\n]/.test(normalizedMessage)) {
    throw new Error('Commit description must be a non-empty single line.');
  }

  return `${validType}${normalizedScope ? `(${normalizedScope})` : ''}${breaking ? '!' : ''}: ${normalizedMessage}`;
}

async function promptCommitType(question: (prompt: string) => Promise<string>): Promise<CommitType> {
  logger.info('Select commit type:');
  COMMIT_TYPES.forEach(([type, description], index) => {
    logger.info(`  ${index + 1}. ${type.padEnd(8)} ${description}`);
  });

  while (true) {
    const answer = (await question(`Type [1-${COMMIT_TYPES.length}]: `)).trim();
    const selected = COMMIT_TYPES[Number(answer) - 1];
    if (selected) return selected[0];
    logger.warn('Please enter a valid commit type number.');
  }
}

function validateCommitType(type: string): CommitType {
  const normalized = type.trim();
  const match = COMMIT_TYPES.find(([candidate]) => candidate === normalized);
  if (!match) {
    throw new Error(`Unsupported commit type "${type}". Use one of: ${COMMIT_TYPES.map(([candidate]) => candidate).join(', ')}.`);
  }
  return match[0];
}

function runCommand(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error,
  };
}

function commandError(prefix: string, result: CommandResult): string {
  const detail = result.stderr?.trim() || result.stdout?.trim() || result.error?.message;
  return detail ? `${prefix} ${detail}` : prefix;
}
