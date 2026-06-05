import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { fileURLToPath } from 'node:url';

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
];

export function buildCommitMessage(type, scope, message, breaking = false) {
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

export async function main(argv = process.argv.slice(2)) {
  assertGitRepository();
  assertStagedChanges();

  const options = parseArgs(argv);
  const needsPrompt = !options.type || !options.message;
  const rl = needsPrompt ? readline.createInterface({ input: stdin, output: stdout }) : undefined;

  try {
    const type = options.type ?? await promptCommitType(rl);
    const scope = options.scope ?? (needsPrompt ? await rl.question('Scope (optional): ') : '');
    const message = options.message ?? await rl.question('Description: ');
    const commitMessage = buildCommitMessage(type, scope, message, options.breaking);
    const result = spawnSync('git', ['commit', '-m', commitMessage], { encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });

    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout?.trim() || result.error?.message || 'Git commit failed.');
    }

    if (result.stdout?.trim()) console.log(result.stdout.trim());
    console.log(`Committed: ${commitMessage}`);
  } finally {
    rl?.close();
  }
}

function parseArgs(argv) {
  const options = { breaking: false };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--breaking') {
      options.breaking = true;
      continue;
    }

    if (['--type', '--scope', '--message'].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`Missing value for ${argument}.`);
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${argument}`);
  }

  return options;
}

async function promptCommitType(rl) {
  console.log('Select commit type:');
  COMMIT_TYPES.forEach(([type, description], index) => {
    console.log(`  ${index + 1}. ${type.padEnd(8)} ${description}`);
  });

  while (true) {
    const answer = (await rl.question(`Type [1-${COMMIT_TYPES.length}]: `)).trim();
    const selected = COMMIT_TYPES[Number(answer) - 1];
    if (selected) return selected[0];
    console.warn('Please enter a valid commit type number.');
  }
}

function validateCommitType(type) {
  const normalized = type.trim();
  if (!COMMIT_TYPES.some(([candidate]) => candidate === normalized)) {
    throw new Error(`Unsupported commit type "${type}". Use one of: ${COMMIT_TYPES.map(([candidate]) => candidate).join(', ')}.`);
  }
  return normalized;
}

function assertGitRepository() {
  const result = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('npm run commit must be run inside a Git repository.');
}

function assertStagedChanges() {
  const result = spawnSync('git', ['diff', '--cached', '--quiet'], { encoding: 'utf8' });
  if (result.status === 0) throw new Error('No staged changes found. Run git add first.');
  if (result.status !== 1) throw new Error(result.stderr?.trim() || 'Could not inspect staged changes.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
