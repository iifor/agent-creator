import { NextResponse } from 'next/server';

export function requireAgentApiKey(request: Request): NextResponse | undefined {
  const expected = process.env.AGENT_API_KEY?.trim();
  if (!expected) {
    if (process.env.NODE_ENV !== 'production') return undefined;
    return NextResponse.json(
      {
        success: false,
        intent: 'service_misconfigured',
        message: 'AGENT_API_KEY is required in production.',
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get('authorization') ?? '';
  const actual = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (actual === expected) return undefined;

  return NextResponse.json(
    {
      success: false,
      intent: 'unauthorized',
      message: 'Missing or invalid Agent API key.',
    },
    { status: 401 },
  );
}
