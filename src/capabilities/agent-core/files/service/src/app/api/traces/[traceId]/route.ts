import { NextResponse } from 'next/server';
import config from '../../../../../agent.config';
import { getTrace } from '../../../../traces/traceStore';

export async function GET(_request: Request, context: { params: Promise<{ traceId: string }> }) {
  const { traceId } = await context.params;
  const trace = await getTrace(config.trace.directory, traceId);
  if (!trace) {
    return NextResponse.json({ error: 'Trace not found.' }, { status: 404 });
  }
  return NextResponse.json(trace);
}
