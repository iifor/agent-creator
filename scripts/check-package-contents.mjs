import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packages = [
  {
    name: '@agent-creator/core',
    cwd: path.join(root, 'packages/core'),
    required: ['package.json', 'README.md', 'dist/index.js', 'dist/index.d.ts'],
    forbiddenPrefixes: ['src/', 'tests/'],
  },
  {
    name: 'agent-creator-cli',
    cwd: path.join(root, 'packages/cli'),
    required: [
      'package.json',
      'README.md',
      'dist/src/index.js',
      'dist/src/commands/validate.js',
      'dist/src/capabilities/agent-core/files/base/package.json',
      'dist/src/capabilities/agent-core/files/service/package.json',
    ],
    forbiddenPrefixes: ['src/', 'tests/'],
  },
];

for (const packageDefinition of packages) {
  const files = packFiles(packageDefinition.cwd);
  const forbidden = files.filter((file) => packageDefinition.forbiddenPrefixes.some((prefix) => file.startsWith(prefix)));
  if (forbidden.length > 0) {
    fail(`${packageDefinition.name} contains forbidden files:\n${forbidden.map((file) => `- ${file}`).join('\n')}`);
  }
  const missing = packageDefinition.required.filter((file) => !files.includes(file));
  if (missing.length > 0) {
    fail(`${packageDefinition.name} is missing required files:\n${missing.map((file) => `- ${file}`).join('\n')}`);
  }
  console.log(`${packageDefinition.name} package contents OK (${files.length} files).`);
}

function packFiles(cwd) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--cache', '/private/tmp/agent-creator-npm-cache'], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) fail(result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout.match(/\[[\s\S]*\]/)?.[0] ?? '[]');
  return payload[0]?.files?.map((file) => file.path) ?? [];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
