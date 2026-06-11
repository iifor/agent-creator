import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileTraceProvider, TRACE_FORMAT_VERSION } from '../src/index.js';

describe('standard trace providers', () => {
  it('writes versioned redacted trace documents', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-trace-'));
    const provider = new FileTraceProvider({ directory });
    const run = provider.start({
      input: 'private prompt',
      requestId: 'request-1',
      metadata: { authorization: 'Bearer secret' },
    }, 'trace-1');
    await run.append({
      type: 'skill.attempt.start',
      data: {
        name: 'calendar.search',
        input: { query: 'private query' },
        authorization: 'Bearer secret',
        safe: 'visible',
      },
    });
    await run.end({
      success: false,
      intent: 'runtime_error',
      message: 'private failure details',
      errorDetails: [{ code: 'skill_forbidden', message: 'private reason' }],
      traceId: 'trace-1',
      requestId: 'request-1',
    });

    const document = JSON.parse(await fs.readFile(path.join(directory, 'trace-1.json'), 'utf8'));
    expect(document).toMatchObject({
      formatVersion: TRACE_FORMAT_VERSION,
      traceId: 'trace-1',
      requestId: 'request-1',
      input: { inputLength: 14, hasSessionId: false, hasUserId: false },
      finalOutput: {
        success: false,
        intent: 'runtime_error',
        errorCodes: ['skill_forbidden'],
      },
    });
    expect(JSON.stringify(document)).not.toContain('private prompt');
    expect(JSON.stringify(document)).not.toContain('private query');
    expect(JSON.stringify(document)).not.toContain('Bearer secret');
    expect(document.events[0].data.safe).toBe('visible');
    expect(document.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
