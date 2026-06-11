import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { traceCommand } from '../src/commands/trace.js';

describe('trace command', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the standard FileTraceProvider format', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-trace-'));
    const previous = process.cwd();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await fs.mkdir(path.join(dir, '.agent-traces'));
    await fs.writeFile(path.join(dir, '.agent-traces', 'trace_001.json'), JSON.stringify({
      formatVersion: '0.1',
      traceId: 'trace_001',
      requestId: 'request_001',
      startedAt: '2026-06-11T00:00:00.000Z',
      endedAt: '2026-06-11T00:00:00.010Z',
      latencyMs: 10,
      inputSummary: { promptLength: 4, hasUserId: false, hasSessionId: false, metadataKeys: [] },
      events: [],
      finalOutput: { success: false, intent: 'skill_forbidden', errorCodes: ['skill_forbidden'] },
    }), 'utf8');
    process.chdir(dir);
    try {
      await traceCommand({ latest: true });
      const output = log.mock.calls.flat().join('\n');
      expect(output).toContain('trace_001');
      expect(output).toContain('request=request_001');
      expect(output).toContain('format=0.1');
      expect(output).toContain('skill_forbidden');
    } finally {
      process.chdir(previous);
    }
  });
});
