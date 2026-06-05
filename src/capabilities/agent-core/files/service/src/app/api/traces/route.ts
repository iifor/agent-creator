import { NextResponse } from 'next/server';
import config from '../../../../agent.config';
import { listTraces } from '../../../traces/traceStore';

export async function GET() {
  const traces = await listTraces(config.trace.directory);
  return NextResponse.json({ traces });
}
