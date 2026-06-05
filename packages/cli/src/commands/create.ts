import fs from 'node:fs/promises';
import path from 'node:path';
import type { CreateOptions } from '../types/cli.js';
import { getCapability } from '../capabilities/index.js';
import { pathExists, writeFileEnsured } from '../utils/fs.js';
import { resolveProjectPath } from '../utils/path.js';
import { logger } from '../utils/logger.js';
import { installCommand } from '../utils/packageManager.js';

export async function createCommand(name: string, options: CreateOptions): Promise<void> {
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
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  for (const file of await capability.files(name, { ...options, mode })) {
    await writeFileEnsured(path.join(targetDir, file.path), file.content);
  }

  const packageManager = options.packageManager ?? 'npm';
  logger.success(`Created ${name} with ${capability.name}.`);
  logger.info('');
  logger.info(`cd ${name}`);
  logger.info(installCommand(packageManager));
  logger.info('npm run dev');
  logger.info('npm test');
}
