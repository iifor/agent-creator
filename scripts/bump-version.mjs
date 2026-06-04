import fs from 'node:fs/promises';
import path from 'node:path';

const release = readReleaseArg(process.argv.slice(2));
const dryRun = process.argv.includes('--dry-run');
const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

if (!release) {
  fail('Missing --release. Use one of: fix, hotfix, feat, breaking.');
}

const bump = releaseToBump(release);
const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
const oldVersion = packageJson.version;
const nextVersion = bumpVersion(oldVersion, bump);

if (!dryRun) {
  packageJson.version = nextVersion;
  await fs.writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  await updatePackageLock(lockPath, nextVersion);
}

console.log(`${dryRun ? '[dry-run] ' : ''}${oldVersion} -> ${nextVersion} (${release} => ${bump})`);

function readReleaseArg(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--release') return args[index + 1];
    if (arg.startsWith('--release=')) return arg.slice('--release='.length);
  }
  return undefined;
}

function releaseToBump(value) {
  if (value === 'fix' || value === 'hotfix') return 'patch';
  if (value === 'feat') return 'minor';
  if (value === 'breaking') return 'major';
  fail(`Unsupported release "${value}". Use one of: fix, hotfix, feat, breaking.`);
}

function bumpVersion(version, bump) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/);
  if (!match) fail(`Invalid package version "${version}". Expected MAJOR.MINOR.PATCH.`);
  let [, major, minor, patch] = match.map(Number);
  if (bump === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (bump === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

async function updatePackageLock(lockFile, nextVersion) {
  try {
    const lock = JSON.parse(await fs.readFile(lockFile, 'utf8'));
    lock.version = nextVersion;
    if (lock.packages?.['']) lock.packages[''].version = nextVersion;
    await fs.writeFile(lockFile, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
