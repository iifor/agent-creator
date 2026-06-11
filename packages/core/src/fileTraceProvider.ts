import fs from 'node:fs/promises';
import path from 'node:path';
import { appendTraceEvent, createTraceDocument, finishTraceDocument } from './trace.js';
import type { AgentInput, TraceProvider, TraceRun } from './types.js';

export interface FileTraceProviderOptions {
  directory?: string;
}

export class FileTraceProvider implements TraceProvider {
  private readonly directory: string;

  constructor(options: FileTraceProviderOptions = {}) {
    this.directory = path.resolve(options.directory ?? '.agent-traces');
  }

  start(input: AgentInput, traceId: string): TraceRun {
    const document = createTraceDocument(input, traceId);
    return {
      append(event) {
        appendTraceEvent(document, event);
      },
      end: async (output) => {
        finishTraceDocument(document, output);
        await fs.mkdir(this.directory, { recursive: true });
        await fs.writeFile(
          path.join(this.directory, `${traceId}.json`),
          `${JSON.stringify(document, null, 2)}\n`,
          { encoding: 'utf8', mode: 0o600 },
        );
      },
    };
  }
}
