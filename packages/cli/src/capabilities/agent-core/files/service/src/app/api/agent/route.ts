import { NextResponse } from 'next/server';
import { runAgent } from '../../../index';
import { requireAgentApiKey } from './auth';

export async function POST(request: Request) {
  const unauthorized = requireAgentApiKey(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const input = typeof body.input === 'string' ? body.input : '';
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
  const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID();
  const output = await runAgent({ input, sessionId, requestId });
  return NextResponse.json(output, {
    headers: { 'x-request-id': output.requestId ?? requestId },
  });
}
