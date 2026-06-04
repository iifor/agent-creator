import fs from 'node:fs/promises';
import path from 'node:path';
import type { TraceRecord } from '../types/trace.js';

export async function writeTrace(directory: string, record: TraceRecord): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${record.traceId}.json`), JSON.stringify(record, null, 2), 'utf8');
}
