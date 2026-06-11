# @agent-creator/core Usage Guide

A composable Agent runtime for building domain-specific AI agents with skills, memory, guards, planning, tracing, webhooks, and OpenAI-compatible models. Replace any built-in module — memory, planner, executor, trace — one at a time.

## Table of Contents

- [Quick Start: createAgent](#quick-start-createagent)
- [Skill](#skill)
- [Direct Skill Invocation](#direct-skill-invocation)
- [MemoryProvider](#memoryprovider)
- [Guard](#guard)
- [TraceProvider](#traceprovider)
- [Webhook](#webhook)
- [Custom Planner](#custom-planner)
- [AgentBuilder Reference](#agentbuilder-reference)
- [Complete Example](#complete-example)

---

## Quick Start: createAgent

`createAgent(options)` is the entry point. It returns an `AgentBuilder` that you configure with the fluent `.use*()` methods, then call `.build()` to get the `Agent` instance.

```ts
import { createAgent } from '@agent-creator/core';

const agent = createAgent({
  model: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
  },
})
  .useSkill(mySkill)
  .build();

const output = await agent.run({
  input: 'Summarize support tickets',
  sessionId: 'session-1',
});
```

### Model Configuration

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `baseUrl` | `string` | ✅ | — | LLM provider endpoint, e.g. `https://api.openai.com/v1` |
| `apiKey` | `string` | ✅ | — | API key for the provider |
| `model` | `string` | ❌ | `gpt-4o-mini` | Model name to use |
| `timeoutMs` | `number` | ❌ | `30000` | Request timeout in milliseconds |
| `maxRetries` | `number` | ❌ | `1` | Max retry attempts (408/429/5xx) |
| `retryBackoffMs` | `number` | ❌ | `250` | Base backoff for retries (exponential) |
| `systemPrompt` | `string` | ❌ | — | System prompt sent with every model call |
| `temperature` | `number` | ❌ | — | Model temperature |
| `maxTokens` | `number` | ❌ | — | Max tokens for model output |
| `responseFormat` | `'text' \| 'json_object' \| object` | ❌ | — | Response format constraint |
| `headers` | `Record<string, string>` | ❌ | — | Additional HTTP headers |

```ts
const agent = createAgent({
  model: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o',
    systemPrompt: 'You are a helpful DevOps assistant.',
    temperature: 0.2,
    maxTokens: 1024,
    responseFormat: 'json_object',
  },
}).build();
```

---

## Skill

Skills are the core unit of domain work — each Skill has a name, Zod-validated input/output schemas, and an `execute` function. The runtime validates inputs before execution and outputs after, so callers and workflows get a stable contract.

### Skill Interface

```ts
interface Skill<I = unknown, O = unknown> {
  name: string;                                        // Dotted name, e.g. 'calendar.search'
  description: string;                                 // What this skill does
  inputSchema: z.ZodType<I>;                           // Zod schema for input validation
  outputSchema: z.ZodType<O>;                          // Zod schema for output validation
  permission?: 'public' | 'external_api' | 'user_private'; // Optional permission tag
  timeoutMs?: number;                                  // Per-execution timeout (ms)
  retry?: number;                                      // Retry count on failure (0 = no retry)
  idempotent?: boolean;                                // Required when retry > 0
  tags?: string[];                                     // Tags for categorization / routing
  execute(input: I, context: SkillContext): Promise<O>; // Business logic
}
```

### Defining a Skill

```ts
import { z } from 'zod';
import type { Skill } from '@agent-creator/core';

const inputSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  limit: z.number().int().min(1).max(100).default(10),
});

const outputSchema = z.object({
  ok: z.boolean(),
  events: z.array(z.object({
    id: z.string(),
    title: z.string(),
    start: z.string(),
    end: z.string(),
  })),
  total: z.number(),
});

export const calendarSearchSkill: Skill<
  z.infer<typeof inputSchema>,
  z.infer<typeof outputSchema>
> = {
  name: 'calendar.search',
  description: 'Search calendar events by query string.',
  inputSchema,
  outputSchema,
  permission: 'user_private',
  timeoutMs: 5000,
  retry: 1,
  idempotent: true,
  tags: ['calendar'],
  async execute(input, context) {
    // Your business logic here
    const events = await searchCalendarApi(input.query, input.limit);
    return { ok: true, events, total: events.length };
  },
};
```

### SkillContext

The `context` parameter in `execute()` provides:

| Property | Type | Description |
|---|---|---|
| `traceId` | `string` | Unique trace ID for this Agent run |
| `executionId` | `string` | Stable ID shared by all attempts of one Skill execution |
| `attempt` | `number` | Current attempt, starting at 1 |
| `idempotencyKey` | `string` | Caller key or generated execution ID, stable across retries |
| `signal` | `AbortSignal` | Aborted when the attempt times out |
| `sessionId` | `string \| undefined` | Session ID from the Agent input |
| `userId` | `string \| undefined` | User ID from the Agent input |
| `metadata` | `Record<string, unknown>` | Arbitrary metadata from the Agent input |
| `webhook` | `WebhookService` | Webhook service for side-effect notifications |
| `trace` | `TraceRun` | Append trace events or end the trace |
| `emitProgress` | `(event) => Promise<void>` | Emit a progress event |

Timeout aborts `context.signal`; the underlying HTTP, database, file, or SDK operation must actively observe that signal to stop work. Code that ignores the signal may continue after the Agent reports a timeout.

### Registering Skills

```ts
// Individual registration
const agent = createAgent({ model })
  .useSkill(calendarSearchSkill)
  .useSkill(ticketCreateSkill)
  .build();

// Batch registration from an array
for (const skill of [calendarSearchSkill, ticketCreateSkill]) {
  builder.useSkill(skill);
}
```

---

## Direct Skill Invocation

Direct Skill selection is privileged server-side behavior. `Agent.run()` ignores `metadata.skill` and `metadata.skillInput`; do not expose arbitrary Skill selection through an HTTP request body.

### Explicit Skill Selection

```ts
const output = await agent.invokeSkill({
  skill: 'calendar.search',
  input: { query: 'tomorrow', limit: 5 },
  userId: trustedUser.id,
  idempotencyKey: request.id,
});
// output.intent === 'skill'
// output.data contains the validated skill output
```

Every Planner-produced or directly invoked Skill passes through the same `SkillAuthorizer`. The built-in policy allows `public`, requires a trusted `userId` for `user_private`, and denies `external_api` unless `.useSkillAuthorizer(...)` explicitly allows it.

### Single-Skill Auto-Routing

When only **one** skill is registered, the default planner automatically routes all requests to it — no metadata needed:

```ts
const agent = createAgent({ model })
  .useSkill(calendarSearchSkill) // only skill registered
  .build();

await agent.run({ input: 'Find events for Friday' });
// Automatically routes to calendar.search
```

### Prefix Routing

When multiple skills are registered, the default planner checks if the input starts with `skillName:`:

```ts
const agent = createAgent({ model })
  .useSkill(calendarSearchSkill)   // name: 'calendar.search'
  .useSkill(ticketCreateSkill)     // name: 'ticket.create'
  .build();

await agent.run({ input: 'ticket.create: Urgent bug in production' });
// Routes to ticket.create
```

### How the Default Planner Resolves Skills

The resolution order in `DefaultPlanner`:

1. **Single registered skill** — when exactly one skill exists
2. **`skillName:` prefix** — input starts with a skill name followed by `:`
3. **`ModelSkillPlanner`** (opt-in) — model-driven selection via `ModelSkillPlanner`
4. **Fallback** — send to the LLM model as a plain chat completion

### Progress Events via metadata

```ts
await agent.run({
  input: 'Process my request',
  sessionId: 'session-1',
  metadata: {
    onProgress(event) {
      // event: { type, message, data?, traceId, at }
      console.log(`${event.type}: ${event.message}`);
    },
  },
});
```

---

## MemoryProvider

`MemoryProvider` stores conversation history per session. The built-in `InMemoryProvider` keeps messages in a `Map` — great for development but not persistent across restarts.

### MemoryProvider Interface

```ts
interface MemoryProvider {
  append(sessionId: string, message: MemoryMessage): void | Promise<void>;
  get(sessionId: string): MemoryMessage[] | Promise<MemoryMessage[]>;
  clear(sessionId?: string): void | Promise<void>;
}

interface MemoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  data?: unknown;
  at: string;  // ISO 8601 timestamp
}
```

### InMemoryProvider (Default)

`InMemoryProvider` is intended for development and tests. `runtimeMode: 'production'` makes `build()` fail until `.useMemory(...)` registers an explicit persistent provider.

```ts
import { InMemoryProvider } from '@agent-creator/core';

const agent = createAgent({ model })
  .useMemory(new InMemoryProvider({
    maxMessagesPerSession: 50,   // Keep only the last N messages per session
    maxSessions: 1000,            // Evict oldest sessions when exceeded
    ttlMs: 3600_000,              // Auto-clear sessions inactive for 1 hour
  }))
  .build();
```

| Option | Default | Description |
|---|---|---|
| `maxMessagesPerSession` | unlimited | Trim each session to the last N messages |
| `maxSessions` | unlimited | Max number of sessions; evicts oldest (FIFO) |
| `ttlMs` | unlimited | Time-to-live: clear sessions not touched for this long |

### Custom MemoryProvider (e.g., Redis)

```ts
import type { MemoryProvider, MemoryMessage } from '@agent-creator/core';

class RedisMemoryProvider implements MemoryProvider {
  constructor(private readonly redis: Redis) {}

  async append(sessionId: string, message: MemoryMessage): Promise<void> {
    const key = `agent:memory:${sessionId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.expire(key, 86400); // 24h TTL
    await this.redis.ltrim(key, -100, -1); // keep last 100
  }

  async get(sessionId: string): Promise<MemoryMessage[]> {
    const raw = await this.redis.lrange(`agent:memory:${sessionId}`, 0, -1);
    return raw.map((r) => JSON.parse(r));
  }

  async clear(sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.redis.del(`agent:memory:${sessionId}`);
    } else {
      // Clear all agent memory keys
      const keys = await this.redis.keys('agent:memory:*');
      if (keys.length) await this.redis.del(keys);
    }
  }
}
```

### How Memory Works

1. On `agent.run()`, if `sessionId` is provided, existing messages are loaded and passed to the planner as `context.memory`
2. The model provider includes memory messages in the chat completion request (as prior messages)
3. After a successful run, the user input and agent response are appended to memory
4. Memory is session-scoped — each `sessionId` has its own conversation thread

---

## Guard

Guards run **before** any planner or executor logic. They enforce domain boundaries, safety policies, and permissions. If a guard returns `{ allowed: false }`, the agent short-circuits and returns early.

### Guard Interface

```ts
interface Guard {
  check(context: AgentContext): GuardResult | Promise<GuardResult>;
}

interface GuardResult {
  allowed: boolean;
  reason?: string;  // Shown to the caller when blocked
}
```

The `AgentContext` passed to `check()` includes:

| Property | Type | Description |
|---|---|---|
| `input` | `AgentInput` | The full original input |
| `memory` | `MemoryMessage[]` | Current session memory |
| `availableSkills` | `Skill[]` (partial) | All registered skills (name, description, schemas, tags) |
| `webhook` | `WebhookService` | Webhook service |
| `trace` | `TraceRun` | Trace for this run |

### BasicGuard / DefaultGuard (Built-in)

These are the same class — `DefaultGuard` is an alias for `BasicGuard`. Use options to configure:

```ts
import { BasicGuard } from '@agent-creator/core';

const agent = createAgent({ model })
  .useGuard(new BasicGuard({
    maxInputLength: 4000,                          // Reject long inputs
    allowlist: [/^(help|search|find|create)\b/i],  // Only allow these patterns
    blocklist: ['delete all', /DROP\s+TABLE/i],    // Block these patterns
  }))
  .build();
```

### Custom Guard

```ts
import type { Guard } from '@agent-creator/core';

class AuthenticationGuard implements Guard {
  async check(context): Promise<GuardResult> {
    const userId = context.input.userId;
    if (!userId) {
      return { allowed: false, reason: 'Authentication required.' };
    }
    // Additional checks: subscription tier, rate limit, etc.
    return { allowed: true };
  }
}

const agent = createAgent({ model })
  .useGuard(new AuthenticationGuard())
  .build();
```

### Composite Guard Pattern

Combine multiple guards into one — all must pass:

```ts
import type { Guard, GuardResult, AgentContext } from '@agent-creator/core';

class CompositeGuard implements Guard {
  constructor(private readonly guards: Guard[]) {}

  async check(context: AgentContext): Promise<GuardResult> {
    for (const guard of this.guards) {
      const result = await guard.check(context);
      if (!result.allowed) return result; // Short-circuit on first block
    }
    return { allowed: true };
  }
}

const agent = createAgent({ model })
  .useGuard(new CompositeGuard([
    new RateLimitGuard(),
    new ContentPolicyGuard(),
    new AuthenticationGuard(),
  ]))
  .build();
```

> **Note:** The CLI-generated projects already include a composite guard in `src/guards/index.ts`.

---

## TraceProvider

Traces capture every step of an Agent run: guard checks, plans, skill execution, model calls, and errors. Built-in providers:

| Provider | Behavior |
|---|---|
| `NoopTraceProvider` (default) | Discards everything — zero overhead |
| `ConsoleTraceProvider` | Prints events to `console.log` / `console.error` |
| `InMemoryTraceProvider` | Stores traces in memory for programmatic access |
| `FileTraceProvider` | Writes redacted format `0.1` JSON documents to `.agent-traces` |

Standard traces correlate `requestId` and `traceId`, and include module duration, model usage, authorization decisions, Skill attempts, structured errors, and a final output summary. Raw prompts, metadata, authorization, API keys, and Skill input/output are redacted by default.

### ConsoleTraceProvider

```ts
import { ConsoleTraceProvider } from '@agent-creator/core';

const agent = createAgent({ model })
  .useTrace(new ConsoleTraceProvider())
  .build();

// Prints:
// [trace_xxx] trace.start { input: '...' }
// [trace_xxx] guard.started ...
// [trace_xxx] skill.start { name: 'calendar.search' }
// [trace_xxx] trace.end { success: true, ... }
```

### InMemoryTraceProvider

```ts
import { InMemoryTraceProvider } from '@agent-creator/core';

const traceProvider = new InMemoryTraceProvider();

const agent = createAgent({ model })
  .useTrace(traceProvider)
  .build();

await agent.run({ input: 'Search calendar', sessionId: 's1' });

// Access stored traces
const run = traceProvider.get('trace_xxx');
console.log(run?.events);   // all trace events
console.log(run?.output);   // final AgentOutput
console.log(run?.startedAt); // ISO timestamp

// List all traces
const allRuns = traceProvider.list();

// Clear traces
traceProvider.clear();              // clear all
traceProvider.clear('trace_xxx');   // clear one
```

### FileTraceProvider

```ts
import { FileTraceProvider } from '@agent-creator/core';

const agent = createAgent({ model })
  .useTrace(new FileTraceProvider({ directory: '.agent-traces' }))
  .build();
```

Production applications can implement `TraceProvider` to export the same events to OpenTelemetry, a database, or a logging platform.

---

## Webhook

Webhook is a runtime service for developer-controlled HTTP notifications — useful for CI/CD integrations, alerting, and audit logging. It is **best-effort**: delivery failures never fail the Agent run.

### Webhook Interface

```ts
interface WebhookService {
  notify(payload: WebhookPayload, trace?: TraceRun): Promise<WebhookDeliveryResult>;
}

interface WebhookPayload {
  event: WebhookEvent;  // 'build.completed' | 'build.failed' | 'directUpload.completed' | 'directUpload.failed'
  message: string;
  timestamp?: string;   // auto-generated if omitted
  logs?: string[];
  error?: string;
}

interface WebhookDeliveryResult {
  delivered: boolean;
  status?: number;
  statusText?: string;
  error?: string;
}
```

### Configuring the Webhook URL

```ts
const agent = createAgent({
  model: { baseUrl, apiKey },
  webhook: {
    url: process.env.WEBHOOK_URL!,
    timeoutMs: 5000,                          // per-delivery timeout
    headers: { 'x-custom': 'value' },         // additional headers
  },
}).build();
```

### Using Webhook from a Skill

Access `context.webhook.notify()` inside any skill's `execute()`:

```ts
const deploySkill: Skill = {
  name: 'deploy.run',
  description: 'Run a deployment',
  inputSchema: z.object({ project: z.string() }),
  outputSchema: z.object({ ok: z.boolean() }),
  async execute(input, context) {
    try {
      await runDeploy(input.project);
      await context.webhook.notify({
        event: 'build.completed',
        message: `Deploy succeeded for ${input.project}`,
        logs: ['Tests passed', 'Bundle size: 142KB'],
      }, context.trace);
      return { ok: true };
    } catch (error) {
      await context.webhook.notify({
        event: 'build.failed',
        message: `Deploy failed for ${input.project}`,
        error: error instanceof Error ? error.message : String(error),
      }, context.trace);
      return { ok: false };
    }
  },
};
```

### Built-in Webhook Skill

Register the pre-built webhook skill to let the Agent itself send notifications:

```ts
import { createWebhookSkill } from '@agent-creator/core';

const agent = createAgent({
  model: { baseUrl, apiKey },
  webhook: { url: process.env.WEBHOOK_URL! },
})
  .useSkill(createWebhookSkill({
    url: process.env.WEBHOOK_URL!,
  }))
  .useSkillAuthorizer({
    authorize({ skill }) {
      return { allowed: skill.name === 'webhook' };
    },
  })
  .build();

await agent.invokeSkill({
  skill: 'webhook',
  input: {
    event: 'build.completed',
    message: 'CI pipeline finished',
    logs: ['Lint: OK', 'Tests: OK', 'Build: OK'],
  },
});
```

Because the webhook Skill declares `external_api`, register a `SkillAuthorizer` that allows this server-controlled operation before invoking it.

### Webhook Service Classes

| Class | Behavior |
|---|---|
| `HttpWebhookService` | Sends actual HTTP POST requests |
| `NoopWebhookService` | No-op (used when no URL is configured) |

### Standalone Webhook Helpers

```ts
import { buildWebhookPayload, sendWebhook, notifyWebhook } from '@agent-creator/core';

// Build a payload manually
const payload = buildWebhookPayload({
  event: 'build.completed',
  message: 'Deploy finished',
  logs: ['All checks passed'],
});

// Send directly (no Agent needed)
const result = await sendWebhook('https://hooks.example.com/agent', payload);
if (!result.delivered) {
  console.error(`Webhook failed: ${result.error}`);
}

// Or use notifyWebhook with a config
const result2 = await notifyWebhook(
  { url: process.env.WEBHOOK_URL!, timeoutMs: 5000 },
  payload,
);
```

---

## Custom Planner

The `Planner` decides what the Agent does with each input — which skill to call, whether to use the model directly, or return a fixed response. Replace the default planner to implement custom routing logic.

### Planner Interface

```ts
interface Planner {
  plan(context: AgentContext): AgentPlan | Promise<AgentPlan>;
}

interface AgentPlan {
  goal: string;
  steps: AgentPlanStep[];
}

type AgentPlanStep =
  | { type: 'model'; task: string; input: unknown }
  | { type: 'skill'; skill: string; input: unknown }
  | { type: 'response'; message: string; data?: unknown };
```

**Step types:**
- `model` — calls the LLM with `task` and `input`; memory is auto-included
- `skill` — executes the named skill with `input`
- `response` — returns a static response without calling model or skills

### DefaultPlanner (Built-in)

The default planner resolves conversational Skill routing as described in [Direct Skill Invocation](#direct-skill-invocation):

1. Single registered skill
2. `skillName:` prefix in input
3. Fallback to model chat completion

### StructuredSkillPlanner (Preferred)

`StructuredSkillPlanner` asks the model for exactly one candidate action: normal model response, one Skill call, or no action. The candidate passes JSON parsing, Skill allowlist, Zod input validation, and Executor authorization before any Skill executes.

```ts
import {
  StructuredSkillPlanner,
  createOpenAICompatibleProvider,
} from '@agent-creator/core';

const modelProvider = createOpenAICompatibleProvider(model);

const agent = createAgent({ model })
  .useSkill(calendarSearchSkill)
  .useSkill(ticketCreateSkill)
  .usePlanner(new StructuredSkillPlanner(modelProvider, {
    allowedSkills: ['calendar.search', 'ticket.create'],
    invalidResult: 'model',
  }))
  .build();
```

Malformed JSON, invented Skills, and invalid parameters never execute a Skill. `invalidResult: 'model'` falls back to a normal response; `'error'` returns a diagnostic response. `ModelSkillPlanner` is deprecated and will be removed after one minor compatibility release.

### Custom Planner Examples

#### Intent-Based Router

Route based on simple keyword matching:

```ts
import type { Planner, AgentContext, AgentPlan } from '@agent-creator/core';

class IntentRouter implements Planner {
  plan(context: AgentContext): AgentPlan {
    const input = context.input.input.toLowerCase();

    if (input.includes('calendar') || input.includes('schedule')) {
      return {
        goal: 'Search calendar',
        steps: [{ type: 'skill', skill: 'calendar.search', input: context.input.input }],
      };
    }

    if (input.includes('ticket') || input.includes('bug') || input.includes('issue')) {
      return {
        goal: 'Handle ticket',
        steps: [{ type: 'skill', skill: 'ticket.create', input: context.input.input }],
      };
    }

    return {
      goal: 'Generate a response',
      steps: [{ type: 'model', task: 'generate_response', input: context.input.input }],
    };
  }
}
```

#### Conditional Planner

```ts
class ContextAwarePlanner implements Planner {
  plan(context: AgentContext): AgentPlan {
    const { input, availableSkills } = context;

    // Route to model if no matching skills
    if (availableSkills.length === 0) {
      return {
        goal: 'Chat response',
        steps: [{ type: 'model', task: 'chat', input: input.input }],
      };
    }

    // Default: let the model decide
    return {
      goal: 'Intelligent routing',
      steps: [{ type: 'model', task: 'select_action', input: input.input }],
    };
  }
}
```

---

## AgentBuilder Reference

The complete fluent API for configuring an Agent:

```ts
const builder = createAgent({ model: { baseUrl, apiKey } });

builder
  .useSkill(skill)         // Register a Skill
  .useMemory(memory)        // Set a MemoryProvider (default: InMemoryProvider)
  .usePlanner(planner)      // Set a Planner (default: DefaultPlanner)
  .useExecutor(executor)    // Set an Executor (default: DefaultExecutor)
  .useModel(model)          // Set a ModelProvider (default: OpenAI-compatible)
  .useGuard(guard)          // Set a Guard (default: DefaultGuard)
  .useSkillAuthorizer(auth) // Add application authorization; required for external_api
  .useTrace(trace)          // Set a TraceProvider (default: NoopTraceProvider)
  .useWebhook(webhook);     // Set a WebhookService (default: NoopWebhookService)

const agent = builder.build();
```

Every `.use*()` method returns `this`, so calls can be chained. The `build()` method validates that all required methods are present before constructing the Agent.

### Agent.run() Input / Output

```ts
// Input
interface AgentInput {
  input: string;                            // The user's request
  requestId?: string;                       // Correlates progress, output, and Trace
  userId?: string;                          // Optional user identifier
  sessionId?: string;                       // Session key for memory persistence
  metadata?: Record<string, unknown>;       // Application metadata and onProgress
}

interface AgentSkillInvocation {
  skill: string;
  input: unknown;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

// Output
interface AgentOutput {
  success: boolean;                         // Did the run succeed?
  intent: string;                           // 'skill' | 'generate_response' | 'safe_redirect' | ...
  message: string;                          // Human-readable result
  data?: unknown;                           // Structured result data (e.g., skill output)
  warnings?: string[];                      // Non-fatal warnings
  errors?: string[];                        // Error messages (success: false)
  errorDetails?: AgentError[];              // Structured error info
  requestId?: string;                       // Stable request correlation ID
  traceId?: string;                         // Trace ID for this run
}
```

---

## Complete Example

Putting it all together — a support Agent with custom memory (Redis), authentication guard, calendar and ticket skills, webhook notifications, and console tracing:

```ts
import {
  createAgent,
  ConsoleTraceProvider,
  BasicGuard,
  createWebhookSkill,
  type Skill,
  type MemoryProvider,
  type Guard,
} from '@agent-creator/core';
import { z } from 'zod';
import { Redis } from 'ioredis';

// ── Custom Memory (Redis) ──────────────────────────────────
class RedisMemory implements MemoryProvider {
  constructor(private redis: Redis) {}
  async append(sessionId: string, msg: any) {
    await this.redis.rpush(`mem:${sessionId}`, JSON.stringify(msg));
    await this.redis.ltrim(`mem:${sessionId}`, -50, -1);
  }
  async get(sessionId: string) {
    const raw = await this.redis.lrange(`mem:${sessionId}`, 0, -1);
    return raw.map((r) => JSON.parse(r));
  }
  async clear(sessionId?: string) {
    if (sessionId) await this.redis.del(`mem:${sessionId}`);
  }
}

// ── Skills ─────────────────────────────────────────────────
const ticketSearchSkill: Skill = {
  name: 'ticket.search',
  description: 'Search support tickets.',
  inputSchema: z.object({ query: z.string().min(1) }),
  outputSchema: z.object({ ok: z.boolean(), tickets: z.array(z.unknown()) }),
  timeoutMs: 5000,
  retry: 1,
  idempotent: true,
  permission: 'user_private',
  async execute(input, context) {
    const tickets = await searchTickets(input.query);
    await context.webhook.notify({
      event: 'directUpload.completed',
      message: `Ticket search completed: ${input.query}`,
    });
    return { ok: true, tickets };
  },
};

const summarySkill: Skill = {
  name: 'ticket.summarize',
  description: 'Summarize ticket contents.',
  inputSchema: z.object({ content: z.string() }),
  outputSchema: z.object({ ok: z.boolean(), summary: z.string() }),
  async execute(input) {
    return { ok: true, summary: `Summary: ${input.content.slice(0, 200)}...` };
  },
};

// ── Guard ──────────────────────────────────────────────────
class AuthGuard implements Guard {
  async check(context) {
    if (!context.input.userId) {
      return { allowed: false, reason: 'Authentication required.' };
    }
    return { allowed: true };
  }
}

// ── Assemble ───────────────────────────────────────────────
const redis = new Redis();
const agent = createAgent({
  runtimeMode: 'production',
  model: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful support agent.',
    temperature: 0.3,
  },
  webhook: {
    url: process.env.WEBHOOK_URL!,
    timeoutMs: 5000,
  },
})
  .useSkill(ticketSearchSkill)
  .useSkill(summarySkill)
  .useSkill(createWebhookSkill({ url: process.env.WEBHOOK_URL! }))
  .useMemory(new RedisMemory(redis))
  .useGuard(new AuthGuard())
  .useSkillAuthorizer({
    authorize({ skill }) {
      return { allowed: ['ticket.search', 'ticket.summarize', 'webhook'].includes(skill.name) };
    },
  })
  .useTrace(new ConsoleTraceProvider())
  .build();

// ── Run ────────────────────────────────────────────────────
const output = await agent.invokeSkill({
  skill: 'ticket.search',
  input: { query: 'login issues' },
  userId: 'user-42',
  sessionId: 'support-session-1',
  metadata: {
    onProgress(event) {
      console.log(`${event.type}: ${event.message}`);
    },
  },
});

console.log(output);
// {
//   success: true,
//   intent: 'skill',
//   message: 'ticket.search completed.',
//   data: { ok: true, tickets: [...] },
//   traceId: 'trace_...'
// }

await redis.quit();
```
