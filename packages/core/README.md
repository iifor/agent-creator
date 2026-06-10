# @agent-creator/core

Composable Agent runtime for skills, memory, planning, execution, guards, traces, and OpenAI-compatible models.

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

- `InMemoryProvider`: process-local session memory with optional message/session limits and TTL.
- `BasicGuard` / `DefaultGuard`: configurable max input length, blocklist, and allowlist checks.
- `DefaultPlanner`: explicit skill routing via `metadata.skill`, single-skill auto routing, and `skill.name:` prefix routing.
- `ModelSkillPlanner`: optional model-driven skill selection that falls back to normal model responses.
- `DefaultExecutor`: validates skill I/O, applies optional skill `timeoutMs` and `retry`, and emits progress events.
- `ConsoleTraceProvider` and `InMemoryTraceProvider`: built-in tracing for development and tests.
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
  tags: ['calendar'],
  async execute(input, context) {
    return searchCalendar(input, context.userId);
  },
};
```

`metadata.skill` and `metadata.skillInput` are stable default-planner conventions for directly invoking a skill:

```ts
await agent.run({
  input: 'Search calendar',
  metadata: {
    skill: 'calendar.search',
    skillInput: { query: 'today' },
  },
});
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
