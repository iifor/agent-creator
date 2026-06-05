import type { AgentOutput, AgentProgressEvent } from '@agent-creator/core';
import { runAgent } from '../../../../index';

type StreamEvent =
  | { type: 'progress'; event: AgentProgressEvent }
  | { type: 'final'; output: AgentOutput };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const input = typeof body.input === 'string' ? body.input : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: StreamEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        const output = await runAgent({
          input,
          sessionId,
          metadata: {
            onProgress(event: AgentProgressEvent) {
              send({ type: 'progress', event });
            },
          },
        });
        send({ type: 'final', output });
      } catch (error) {
        send({
          type: 'final',
          output: {
            success: false,
            intent: 'stream_error',
            message: 'Agent stream failed.',
            errors: [error instanceof Error ? error.message : String(error)],
          },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache',
    },
  });
}
