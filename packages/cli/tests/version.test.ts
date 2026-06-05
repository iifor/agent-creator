import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildCli } from '../src/cli/cli.js';
import { CLI_VERSION } from '../src/version.js';

describe('versioning', () => {
  it('uses package.json as the CLI version source', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { version: string };
    expect(CLI_VERSION).toBe(packageJson.version);
    expect(buildCli().version()).toBe(packageJson.version);
  });
});
