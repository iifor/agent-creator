import type { z } from 'zod';

export interface ToolContext {
  traceId: string;
  sessionId?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodSchema;
  outputSchema: z.ZodSchema;
  permission: 'public' | 'external_api' | 'user_private';
  timeoutMs: number;
  retry: number;
  handler: (input: unknown, context: ToolContext) => Promise<unknown>;
}
