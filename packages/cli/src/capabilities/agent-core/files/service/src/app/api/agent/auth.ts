import { NextResponse } from 'next/server';

export function requireAgentApiKey(request: Request): NextResponse | undefined {
  const expected = process.env.AGENT_API_KEY?.trim();
  if (!expected) return undefined;

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
