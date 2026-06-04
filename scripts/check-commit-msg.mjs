import fs from 'node:fs';

const file = process.argv[2];

if (!file) {
  fail('Missing commit message file path.');
}

let message = '';
try {
  message = fs.readFileSync(file, 'utf8').trim();
} catch (error) {
  fail(`Could not read commit message file: ${error instanceof Error ? error.message : String(error)}`);
}

const firstLine = message.split(/\r?\n/, 1)[0];
const allowedTypes = ['feat', 'fix', 'hotfix', 'docs', 'test', 'refactor', 'chore', 'build', 'ci', 'perf', 'revert'];
const pattern = new RegExp(`^(${allowedTypes.join('|')})(\\([a-z0-9._-]+\\))?(!)?: .+`);

if (pattern.test(firstLine) || /^Merge /.test(firstLine)) {
  process.exit(0);
}

fail(`Invalid commit message: "${firstLine}"

Use Conventional Commits:
  feat: add a new command
  fix(cli): handle invalid options
  hotfix: patch release issue
  refactor!: change template compatibility

Allowed types: ${allowedTypes.join(', ')}
`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
