# @agent-creator/core

Composable Agent runtime for skills, memory, planning, execution, guards, traces, and OpenAI-compatible models.

> Full usage guide: [docs/core-usage.md](docs/core-usage.md) covers `createAgent`, `invokeSkill`, authorization, MemoryProvider, Guard, TraceProvider, Webhook, and custom Planner.

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
  .useMemory(myMemory)
  .usePlanner(myPlanner)
  .useExecutor(myExecutor)
  .build();

await agent.run({ input: 'Run my task', sessionId: 'session-1' });
```

`baseUrl`, `apiKey`, and `model` are required. The package does not read environment variables automatically.

## Built-In Modules

`@agent-creator/core` includes lightweight defaults that can be replaced one at a time:

- `InMemoryProvider`: development-only process memory with optional message/session limits and TTL.
- `BasicGuard` / `DefaultGuard`: configurable max input length, blocklist, and allowlist checks.
- `DefaultPlanner`: single-skill auto routing and `skill.name:` prefix routing.
- `StructuredSkillPlanner`: optional single-action model routing with JSON parsing, Skill allowlist, Zod input validation, and Executor authorization.
- `ModelSkillPlanner`: deprecated legacy model routing; retained for one minor release.
- `DefaultExecutor`: authorizes every Skill, validates I/O, applies cancellable timeout and idempotent retry policies, and emits progress events.
- `FileTraceProvider`, `ConsoleTraceProvider`, and `InMemoryTraceProvider`: versioned, redacted tracing for development and tests.
- `HttpWebhookService` / `NoopWebhookService`: optional webhook notifications available from planners and skills.

Skills can declare optional execution metadata:

```ts
const skill = {
  name: 'calendar.search',
  description: 'Search calendar events',
  inputSchema,
  outputSchema,
  permission: 'user_private',
  timeoutMs: 5000,
  retry: 1,
  idempotent: true,
  tags: ['calendar'],
  async execute(input, context) {
    return searchCalendar(input, context.userId);
  },
};
```

Direct Skill execution is a server-side operation. Use `invokeSkill()` rather than accepting a Skill name through client metadata:

```ts
await agent.invokeSkill({
  skill: 'calendar.search',
  input: { query: 'today' },
  userId: trustedUser.id,
  idempotencyKey: request.id,
});
```

`public` Skills are allowed by default, `user_private` Skills require a trusted `userId`, and `external_api` Skills require a custom `SkillAuthorizer`.

Production mode refuses the default process-local Memory:

```ts
createAgent({ model, runtimeMode: 'production' })
  .useMemory(persistentMemory)
  .build();
```

Use `requestId` to correlate service requests, progress events, output, and Trace:

```ts
await agent.run({ input: 'Help', requestId: 'request-from-edge' });
```

OpenAI-compatible models also support optional generation parameters:

```ts
createAgent({
  model: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
    systemPrompt: 'You are a concise assistant.',
    temperature: 0.2,
    maxTokens: 512,
    responseFormat: 'json_object',
  },
});
```

## Webhook Notifications

Webhook is a runtime service for developer-controlled side effects. Configure the URL in code or environment, then call it from a planner or skill through context:

```ts
const agent = createAgent({
  model,
  webhook: {
    url: process.env.WEBHOOK_URL ?? '',
  },
})
  .useSkill({
    name: 'build.run',
    description: 'Run a build',
    inputSchema,
    outputSchema,
    async execute(input, context) {
      await context.webhook?.notify({
        event: 'build.completed',
        message: `Build completed for ${input.project}`,
      });
      return { ok: true };
    },
  })
  .build();
```

Webhook delivery is best-effort by default: missing URLs, HTTP failures, and network errors do not fail the Agent run. The webhook URL is developer configuration and should not come from model output or user input.

For explicit Agent-triggered notifications, register the optional webhook skill:

```ts
import { createWebhookSkill } from '@agent-creator/core';

builder.useSkill(createWebhookSkill({
  url: process.env.WEBHOOK_URL ?? '',
}));
```
