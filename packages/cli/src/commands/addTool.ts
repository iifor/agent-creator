import type { AddToolOptions } from '../types/cli.js';
import { logger } from '../utils/logger.js';
import { addSkillCommand } from './addSkill.js';

/** @deprecated Use agent add skill. */
export async function addToolCommand(toolName: string, options: AddToolOptions): Promise<void> {
  logger.warn('agent add tool is deprecated; use agent add skill.');
  await addSkillCommand(toolName, options);
}
