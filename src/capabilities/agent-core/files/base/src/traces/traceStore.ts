import fs from 'node:fs/promises';
import path from 'node:path';
import type { TraceRecord } from '../types/trace.js';

export async function writeTrace(directory: string, record: TraceRecord): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, `${record.traceId}.json`), JSON.stringify(record, null, 2), 'utf8');
}

export async function listTraces(directory: string): Promise<Array<{
  traceId: string;
  startedAt: string;
  latencyMs?: number;
  intent?: string;
  success?: boolean;
}>> {
  try {
    const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.json')).sort().reverse();
    const records = await Promise.all(files.map(async (file) => getTrace(directory, file.replace(/\.json$/, ''))));
    return records.filter((record): record is TraceRecord => Boolean(record)).map((record) => ({
      traceId: record.traceId,
      startedAt: record.startedAt,
      latencyMs: record.latencyMs,
      intent: record.finalOutput?.intent,
      success: record.finalOutput?.success,
    }));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

export async function getTrace(directory: string, traceId: string): Promise<TraceRecord | null> {
  try {
    const text = await fs.readFile(path.join(directory, `${traceId}.json`), 'utf8');
    return JSON.parse(text) as TraceRecord;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}
