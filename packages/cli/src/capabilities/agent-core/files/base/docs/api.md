# {{projectName}} API

This project exposes the Agent as both a TypeScript package entrypoint and, in service mode, a small HTTP API.

## Environment

Copy `.env.example` to `.env` and set:

```bash
LLM_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your-openai-api-key
LLM_MODEL=gpt-4o-mini
```

Service mode requires API authentication in production:

```bash
AGENT_API_KEY=replace-with-a-random-secret
```

Production startup without `AGENT_API_KEY` fails closed with HTTP 503. When configured, callers must send:

```http
Authorization: Bearer replace-with-a-random-secret
```

## Package Entrypoint

Use `runAgent()` when calling from another TypeScript or Node.js module in the same process:

```ts
import { runAgent } from './src/index.js';

const output = await runAgent({
  input: 'Summarize today\'s support tickets',
  sessionId: 'support-session-1',
});
```

The default memory provider is process-local in-memory storage. Production mode refuses to build the Agent until `src/index.ts` registers a persistent `MemoryProvider`.

## POST /api/agent

Runs the Agent and returns the final output as JSON.

Request:

```json
{
  "input": "Hello agent",
  "sessionId": "optional-session-id"
}
```

Response:

```json
{
  "success": true,
  "intent": "generate_response",
  "message": "Hello! How can I help?",
  "data": {},
  "requestId": "request_...",
  "traceId": "trace_..."
}
```

Clients may send `x-request-id`; otherwise the service generates one. The response repeats it in the `x-request-id` header and JSON output. Request bodies do not accept `metadata` or `userId`.

Example:

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "content-type: application/json" \
  -d '{"input":"Hello agent","sessionId":"demo"}'
```

With `AGENT_API_KEY` configured:

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "authorization: Bearer $AGENT_API_KEY" \
  -H "content-type: application/json" \
  -d '{"input":"Hello agent","sessionId":"demo"}'
```

## POST /api/agent/stream

Runs the Agent and streams progress as newline-delimited JSON (`application/x-ndjson`).

Each line is one of:

```json
{ "type": "progress", "event": { "type": "agent.started", "message": "Agent started", "requestId": "request_...", "traceId": "trace_...", "at": "..." } }
```

```json
{ "type": "final", "output": { "success": true, "intent": "generate_response", "message": "Done", "requestId": "request_...", "traceId": "trace_..." } }
```

Example:

```bash
curl -N -X POST http://localhost:3000/api/agent/stream \
  -H "content-type: application/json" \
  -d '{"input":"Hello agent","sessionId":"demo"}'
```

## GET /api/agent/health

Returns service readiness metadata without exposing secrets.

Response:

```json
{
  "ok": true,
  "name": "{{projectName}}",
  "version": "{{capabilityVersion}}",
  "service": {
    "enabled": true,
    "framework": "next"
  },
  "model": {
    "configured": true,
    "baseUrlConfigured": true,
    "apiKeyConfigured": true,
    "model": "gpt-4o-mini"
  }
}
```

`ok` is `false` when required model configuration is missing.

## TypeScript HTTP Client

`src/client.ts` exports helpers for another frontend or backend to call the service:

```ts
import { runAgentHttp, streamAgentHttp } from './src/client.js';

const output = await runAgentHttp({
  baseUrl: 'http://localhost:3000',
  input: 'Hello agent',
  sessionId: 'demo',
});

for await (const event of streamAgentHttp({
  baseUrl: 'http://localhost:3000',
  input: 'Show progress',
  sessionId: 'demo',
})) {
  console.log(event);
}
```

Pass `apiKey` for production service calls.

## Webhook Skill And Runtime Service

Add the optional built-in webhook Skill adapter:

```bash
agent add skill webhook
```

Set the target URL in `.env`:

```bash
WEBHOOK_URL=https://example.com/webhook
```

Call it from trusted server code after registering a `SkillAuthorizer` for the `external_api` permission:

```ts
await invokeSkill({
  skill: 'webhook',
  input: {
    event: 'build.completed',
    message: 'Build finished',
    logs: ['npm test passed'],
  },
});
```

For developer-controlled side effects inside your own Skills, configure the runtime service and call `context.webhook?.notify(...)`. Do not read webhook URLs from user input or model output.
