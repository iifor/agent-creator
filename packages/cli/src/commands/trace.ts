import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists, readText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

interface TraceOptions {
  latest?: boolean;
  list?: boolean;
  id?: string;
}

export async function traceCommand(options: TraceOptions): Promise<void> {
  const directory = path.resolve(process.cwd(), '.agent-traces');
  if (!(await pathExists(directory))) {
    throw new Error('No .agent-traces directory found. Run this in a generated Agent project.');
  }

  const files = (await fs.readdir(directory))
    .filter((file) => file.endsWith('.json'))
    .sort();

  if (options.list) {
    if (files.length === 0) {
      logger.info('No traces found.');
      return;
    }
    for (const file of files) logger.info(file.replace(/\.json$/, ''));
    return;
  }

  const selected = options.id ? `${options.id}.json` : files.at(-1);
  if (!selected) {
    logger.info('No traces found.');
    return;
  }

  const content = await readText(path.join(directory, selected));
  const trace = JSON.parse(content) as { traceId: string; finalOutput?: { intent?: string; success?: boolean }; latencyMs?: number };
  if (options.latest || !options.id) {
    logger.info(`${trace.traceId}  ${trace.finalOutput?.intent ?? 'unknown'}  ${trace.finalOutput?.success ? 'success' : 'failed'}  ${trace.latencyMs ?? 0}ms`);
    logger.info(content);
    return;
  }
  logger.info(content);
}
