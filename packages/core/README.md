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
