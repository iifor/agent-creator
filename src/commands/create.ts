import fs from 'node:fs/promises';
import path from 'node:path';
import type { CreateOptions } from '../types/cli.js';
import { getTemplate } from '../templates/index.js';
import { pathExists, writeFileEnsured } from '../utils/fs.js';
import { resolveProjectPath } from '../utils/path.js';
import { logger } from '../utils/logger.js';
import { installCommand } from '../utils/packageManager.js';

export async function createCommand(name: string, options: CreateOptions): Promise<void> {
  const templateName = options.template ?? 'tool-agent';
  const template = getTemplate(templateName);
  const targetDir = resolveProjectPath(name);

  if (await pathExists(targetDir)) {
    if (!options.force) {
      throw new Error(`Directory already exists: ${targetDir}. Use --force to overwrite.`);
    }
    await fs.rm(targetDir, { recursive: true, force: true });
  }

  for (const file of template.files(name)) {
    await writeFileEnsured(path.join(targetDir, file.path), file.content);
  }

  const packageManager = options.packageManager ?? 'npm';
  logger.success(`Created ${name} with ${template.name}.`);
  logger.info('');
  logger.info(`cd ${name}`);
  logger.info(installCommand(packageManager));
  logger.info('npm run dev');
  logger.info('npm test');
}
