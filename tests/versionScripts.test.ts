import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildCommitMessage } from '../scripts/commit.mjs';
import { minifyDist } from '../scripts/minify-dist.mjs';

describe('version scripts', () => {
  it('accepts valid conventional commit messages', async () => {
    const file = await writeTempFile('feat(cli): add version command\n');
    const result = spawnSync('node', ['scripts/check-commit-msg.mjs', file], { encoding: 'utf8' });
    expect(result.status).toBe(0);
  });

  it('rejects invalid commit messages', async () => {
    const file = await writeTempFile('updated stuff\n');
    const result = spawnSync('node', ['scripts/check-commit-msg.mjs', file], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Invalid commit message');
  });

  it('builds project commit messages', () => {
    expect(buildCommitMessage('feat', 'cli', 'add commit command')).toBe('feat(cli): add commit command');
    expect(buildCommitMessage('refactor', undefined, 'change config', true)).toBe('refactor!: change config');
    expect(() => buildCommitMessage('unknown', undefined, 'message')).toThrow('Unsupported commit type');
  });

  it('commits staged project changes non-interactively', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-project-commit-'));
    runGit(dir, ['init', '-q']);
    runGit(dir, ['config', 'user.name', 'Agent Creator Test']);
    runGit(dir, ['config', 'user.email', 'agent@example.com']);
    await fs.writeFile(path.join(dir, 'sample.txt'), 'test\n', 'utf8');
    runGit(dir, ['add', 'sample.txt']);

    const result = spawnSync(
      'node',
      [path.resolve('scripts/commit.mjs'), '--type', 'feat', '--scope', 'cli', '--message', 'add commit command'],
      { cwd: dir, encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(runGit(dir, ['log', '-1', '--pretty=%s']).stdout.trim()).toBe('feat(cli): add commit command');
  });

  it('keeps breaking releases pre-1.0 until the stable contract is ready', () => {
    const currentVersion = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')).version as string;
    const [major, minor] = currentVersion.split('.').map(Number);
    const nextBreakingVersion = major === 0 ? `0.${minor + 1}.0` : `${major + 1}.0.0`;
    const fix = spawnSync('node', ['scripts/bump-version.mjs', '--release', 'fix', '--dry-run'], { encoding: 'utf8' });
    const feat = spawnSync('node', ['scripts/bump-version.mjs', '--release', 'feat', '--dry-run'], { encoding: 'utf8' });
    const breaking = spawnSync('node', ['scripts/bump-version.mjs', '--release', 'breaking', '--dry-run'], { encoding: 'utf8' });

    expect(fix.status).toBe(0);
    expect(fix.stdout).toContain('fix => patch');
    expect(feat.status).toBe(0);
    expect(feat.stdout).toContain('feat => minor');
    expect(breaking.status).toBe(0);
    expect(breaking.stdout).toContain(`${currentVersion} -> ${nextBreakingVersion}`);
    expect(breaking.stdout).toContain(`breaking => ${major === 0 ? 'minor' : 'major'}`);
  });

  it('requires a release type for build', () => {
    const result = spawnSync('node', ['scripts/build.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing required release type');
  });

  it('minifies JavaScript build output without touching excluded templates', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-minify-dist-'));
    await fs.mkdir(path.join(dir, 'templates'), { recursive: true });
    const runtimeFile = path.join(dir, 'index.js');
    const templateFile = path.join(dir, 'templates', 'example.js');
    const source = [
      'const internalValue = 1 + 2;',
      'export function readValue() {',
      '  return internalValue;',
      '}',
      '',
    ].join('\n');

    await fs.writeFile(runtimeFile, source, 'utf8');
    await fs.writeFile(templateFile, source, 'utf8');

    await expect(minifyDist(dir, { excludePrefixes: ['templates'] })).resolves.toBe(1);

    const runtimeOutput = await fs.readFile(runtimeFile, 'utf8');
    const templateOutput = await fs.readFile(templateFile, 'utf8');
    expect(runtimeOutput.length).toBeLessThan(source.length);
    expect(runtimeOutput).not.toContain('internalValue');
    expect(templateOutput).toBe(source);
  });
});

async function writeTempFile(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-commit-msg-'));
  const file = path.join(dir, 'COMMIT_EDITMSG');
  await fs.writeFile(file, content, 'utf8');
  return file;
}

function runGit(cwd: string, args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return result;
}
