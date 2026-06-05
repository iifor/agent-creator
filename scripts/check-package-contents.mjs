import { spawnSync } from 'node:child_process';

const cacheArgs = ['--cache', '/private/tmp/agent-creator-npm-cache'];
const result = spawnSync('npm', ['pack', '--dry-run', '--json', ...cacheArgs], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(result.status ?? 1);
}

const payload = JSON.parse(result.stdout.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
const files = payload[0]?.files?.map((file) => file.path) ?? [];
const forbidden = files.filter((file) => {
  if (file.startsWith('src/')) return true;
  if (file.startsWith('tests/')) return true;
  if (file.startsWith('demo-agent/')) return true;
  if (file.startsWith('demo-service/')) return true;
  if (file.startsWith('.git/')) return true;
  if (file.startsWith('.agent-traces/')) return true;
  if (file === 'tsconfig.json' || file === 'vitest.config.ts' || file === 'todo.md') return true;
  return false;
});

if (forbidden.length > 0) {
  console.error('Package contains forbidden files:');
  for (const file of forbidden) console.error(`- ${file}`);
  process.exit(1);
}

const required = [
  'package.json',
  'README.md',
  'CHANGELOG.md',
  'dist/src/index.js',
  'dist/src/commands/validate.js',
  'dist/src/capabilities/agent-core/files/base/package.json',
  'dist/src/capabilities/agent-core/files/service/package.json',
];

const missing = required.filter((file) => !files.includes(file));
if (missing.length > 0) {
  console.error('Package is missing required files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

console.log(`Package contents OK (${files.length} files).`);
