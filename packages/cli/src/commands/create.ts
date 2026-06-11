import fs from 'node:fs/promises';
import path from 'node:path';
import type { CreateOptions } from '../types/cli.js';
import { getCapability } from '../capabilities/index.js';
import { pathExists, writeFileEnsured } from '../utils/fs.js';
import { resolveProjectPath } from '../utils/path.js';
import { logger } from '../utils/logger.js';
import { installCommand } from '../utils/packageManager.js';

export async function createCommand(name: string, options: CreateOptions): Promise<void> {
  assertSafeProjectName(name);
  const capabilityName = options.capability ?? 'agent-core';
  const mode = options.mode ?? 'service';
  if (!['package', 'service'].includes(mode)) {
    throw new Error(`Unsupported create mode "${mode}". Use "package" or "service".`);
  }
  const capability = getCapability(capabilityName);
  const targetDir = resolveProjectPath(name);

  if (await pathExists(targetDir)) {
    if (!options.force) {
      throw new Error(`Directory already exists: ${targetDir}. Use --force to overwrite.`);
    }
    await assertOwnedGeneratedDirectory(targetDir, name);
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  for (const file of await capability.files(name, { ...options, mode })) {
    await writeFileEnsured(path.join(targetDir, file.path), file.content);
  }
  await writeFileEnsured(path.join(targetDir, '.agent-creator.json'), `${JSON.stringify({
    name,
    capability: capability.name,
    generatedBy: 'agent-creator',
  }, null, 2)}\n`);

  const packageManager = options.packageManager ?? 'npm';
  logger.success(`Created ${name} with ${capability.name}.`);
  logger.info('');
  logger.info(`cd ${name}`);
  logger.info(installCommand(packageManager));
  logger.info('npm run dev');
  logger.info('npm test');
}

function assertSafeProjectName(name: string): void {
  if (
    name.length === 0
    || name.length > 214
    || name === '.'
    || name === '..'
    || path.isAbsolute(name)
    || name.includes('/')
    || name.includes('\\')
    || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(name)
  ) {
    throw new Error(`Invalid project name "${name}". Use a safe non-scoped npm name with lowercase letters, numbers, dots, hyphens, or underscores.`);
  }
}

async function assertOwnedGeneratedDirectory(targetDir: string, expectedName: string): Promise<void> {
  const markerPath = path.join(targetDir, '.agent-creator.json');
  let marker: unknown;
  try {
    marker = JSON.parse(await fs.readFile(markerPath, 'utf8'));
  } catch {
    throw new Error(`Refusing to overwrite ${targetDir}: missing or invalid .agent-creator.json ownership marker.`);
  }
  const value = marker as Record<string, unknown>;
  if (
    value.generatedBy !== 'agent-creator'
    || value.name !== expectedName
    || typeof value.capability !== 'string'
  ) {
    throw new Error(`Refusing to overwrite ${targetDir}: ownership marker does not match project "${expectedName}".`);
  }
}
