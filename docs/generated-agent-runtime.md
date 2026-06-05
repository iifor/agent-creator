# Generated Agent Projects

Generated projects are consumers of `@agent-creator/core`.

## Configuration

`agent.config.ts` records generation metadata, service mode, enabled Skills, and model connection values:

```ts
model: {
  baseUrl: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.OPENAI_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? '',
  timeoutMs: 30000,
  maxRetries: 1,
}
```

Core itself does not read environment variables. The generated project reads them and explicitly passes the resulting object to `createAgent({ model })`.

## Package Mode

Package mode exports a lazily configured Agent, `runAgent`, core `createAgent`, and the public composition types. Skills are registered from `src/skills/index.ts`.

## Service Mode

Service mode adds a Next.js chat UI and `POST /api/agent`. Agent construction is lazy so a production build does not require credentials; credentials are required when the Agent is first executed.

## Validation

`agent validate` checks configuration shape, core dependency presence, Skill files, and required service files.
