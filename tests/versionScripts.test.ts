import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

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

  it('dry-runs patch, minor, and major version bumps', () => {
    const fix = spawnSync('node', ['scripts/bump-version.mjs', '--release', 'fix', '--dry-run'], { encoding: 'utf8' });
    const feat = spawnSync('node', ['scripts/bump-version.mjs', '--release', 'feat', '--dry-run'], { encoding: 'utf8' });
    const breaking = spawnSync('node', ['scripts/bump-version.mjs', '--release', 'breaking', '--dry-run'], { encoding: 'utf8' });

    expect(fix.status).toBe(0);
    expect(fix.stdout).toContain('fix => patch');
    expect(feat.status).toBe(0);
    expect(feat.stdout).toContain('feat => minor');
    expect(breaking.status).toBe(0);
    expect(breaking.stdout).toContain('breaking => major');
  });

  it('requires a release type for build', () => {
    const result = spawnSync('node', ['scripts/build.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Missing required release type');
  });
});

async function writeTempFile(content: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-commit-msg-'));
  const file = path.join(dir, 'COMMIT_EDITMSG');
  await fs.writeFile(file, content, 'utf8');
  return file;
}
