export interface MemoryStore {
  appendMessage(sessionId: string, message: unknown): void | Promise<void>;
  getMessages(sessionId: string): unknown[] | Promise<unknown[]>;
  clear(sessionId?: string): void | Promise<void>;
}

export class InMemoryStore implements MemoryStore {
  private sessions = new Map<string, unknown[]>();

  appendMessage(sessionId: string, message: unknown): void {
    const current = this.sessions.get(sessionId) ?? [];
    current.push(message);
    this.sessions.set(sessionId, current);
  }

  getMessages(sessionId: string): unknown[] {
    return this.sessions.get(sessionId) ?? [];
  }

  clear(sessionId?: string): void {
    if (sessionId) this.sessions.delete(sessionId);
    else this.sessions.clear();
  }
}
