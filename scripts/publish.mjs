import { spawnSync } from 'node:child_process';

const tag = readTag(process.argv.slice(2));

run('npm', ['run', 'build:plain']);
run('npm', ['test']);
run('node', ['scripts/check-package-contents.mjs']);
run('npm', ['publish', '--workspace', '@agent-creator/core', '--access', 'public', '--tag', tag]);
run('npm', ['publish', '--workspace', 'agent-creator-cli', '--access', 'public', '--tag', tag]);

function readTag(args) {
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--tag') return args[index + 1] ?? 'latest';
    if (args[index].startsWith('--tag=')) return args[index].slice('--tag='.length);
  }
  return 'latest';
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
