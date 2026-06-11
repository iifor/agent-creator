# Agent Creator

Agent Creator is an npm workspace for a composable Agent runtime and the CLI that creates projects using it.

## Packages

- `@agent-creator/core`: Agent Builder, Skill registry, memory, planning, execution, guards, traces, and OpenAI-compatible models.
- `@agent-creator/cli`: the `agent` binary for creating package or Next.js service projects.

## Core Usage

```ts
import { createAgent } from '@agent-creator/core';

const agent = createAgent({
  model: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
  },
})
  .useSkill(todoSkill)
  .useMemory(redisMemory)
  .usePlanner(customPlanner)
  .useExecutor(customExecutor)
  .build();

await agent.run({ input: 'Add a task', sessionId: 'session-1' });
```

The model `baseUrl`, `apiKey`, and `model` are required code inputs. Core does not read environment variables implicitly.

## Workspace Commands

```bash
npm install
npm run build:plain
npm test
npm run check:package
npm run commit
```

## CLI Commands

```bash
agent create demo-agent --mode package
agent create demo-service --mode service
agent add skill calendar
agent add tool calendar # deprecated compatibility alias
agent validate
agent validate security
agent validate env
agent validate runtime
agent trace --latest
agent version
```

Generated projects depend on `@agent-creator/core`; they do not contain a copied runtime.
