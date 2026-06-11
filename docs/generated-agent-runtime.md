# Generated Agent Projects

Generated projects are consumers of `@agent-creator/core`.

## Configuration

`agent.config.ts` records generation metadata, service mode, enabled Skills, Guards, Workflows, and model connection values:

```ts
model: {
  baseUrl: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.OPENAI_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? '',
  timeoutMs: 30000,
  maxRetries: 1,
}
```

Core itself does not read environment variables. The generated project reads them and explicitly passes the resulting object to `createAgent({ model, runtimeMode })`.

## Package Mode

Package mode exports a lazily configured Agent, `runAgent`, core `createAgent`, and the public composition types. Skills are registered from `src/skills/index.ts`.

Generated projects also include `src/guards/index.ts`. It composes local Guards in declaration order and registers the composed Guard with `builder.useGuard(guard)`. If no guards are added, it allows all non-empty input and leaves core's default behavior unchanged.

Workflow skeletons are stored under `src/skills` and tagged with `workflow`. They are still registered as Skills; `workflows.enabled` in `agent.config.ts` is metadata for validation and tooling, not a separate core runtime registry.

`runAgent()` handles conversational input and does not interpret `metadata.skill`. Trusted application code uses the generated `invokeSkill()` helper. Every Skill execution is authorized: `public` is allowed, `user_private` requires a trusted `userId`, and `external_api` requires an application `SkillAuthorizer`.

Generated projects pin the exact `@agent-creator/core` version while the packages remain pre-1.0. Production mode must register a persistent MemoryProvider before the Agent can build.

Development mode registers `FileTraceProvider`, writing redacted format `0.1` documents under `.agent-traces`. Production mode leaves Trace backend selection to the application.

## Service Mode

Service mode adds a Next.js chat UI and `POST /api/agent`. Agent construction is lazy so a production build does not require model credentials. Production requests fail closed when `AGENT_API_KEY` is missing. HTTP request bodies accept conversational input and session ID only; `metadata` and `userId` are not accepted.

The service accepts `x-request-id` or generates one, returns it in response headers, and propagates it through progress events, final output, and Trace documents.

## Validation

`agent validate` statically parses the supported TypeScript config subset, then checks configuration shape, core dependency presence, Skill, Guard, and Workflow registration/file consistency, duplicate enabled names, and required service files. It never imports or executes `agent.config.ts`.

Focused checks are also available:

- `agent validate security`: production auth, runtime mode, persistent Memory, and restricted Skill authorization.
- `agent validate env`: deployment environment variables.
- `agent validate runtime`: builds the Agent and verifies module contracts without calling a real model.
