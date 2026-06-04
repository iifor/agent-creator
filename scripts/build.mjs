import { spawnSync } from 'node:child_process';

const releaseArgs = extractReleaseArgs(process.argv.slice(2));

if (releaseArgs.length === 0) {
  console.error('Missing required release type.');
  console.error('Use: npm run build -- --release fix');
  console.error('Available release types: fix, hotfix, feat, breaking.');
  process.exit(1);
}

run('node', ['scripts/bump-version.mjs', ...releaseArgs]);
run('npm', ['run', 'build:plain']);

function extractReleaseArgs(args) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--release') {
      result.push(arg, args[index + 1] ?? '');
      index += 1;
    } else if (arg.startsWith('--release=')) {
      result.push(arg);
    }
  }
  return result;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
