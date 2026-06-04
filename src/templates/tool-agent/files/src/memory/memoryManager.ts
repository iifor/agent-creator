const sessions = new Map<string, unknown[]>();

export function appendSessionMessage(sessionId: string, message: unknown): void {
  const current = sessions.get(sessionId) ?? [];
  current.push(message);
  sessions.set(sessionId, current);
}

export function getSession(sessionId: string): unknown[] {
  return sessions.get(sessionId) ?? [];
}

export function clearMemory(sessionId?: string): void {
  if (sessionId) sessions.delete(sessionId);
  else sessions.clear();
}
