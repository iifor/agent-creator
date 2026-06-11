# @agent-creator/cli

CLI for scaffolding and maintaining runnable Agent projects powered by [`@agent-creator/core`](https://www.npmjs.com/package/@agent-creator/core). Create a package-mode agent (TypeScript library / CLI chat) or a service-mode agent (Next.js web chat + HTTP API) with a single command.

## Quick Start (npx)

```bash
# Create a service-mode Agent (Next.js + HTTP API + Web chat)
npx @agent-creator/cli create my-agent --mode service

# Create a package-mode Agent (TypeScript library + CLI chat)
npx @agent-creator/cli create my-agent-lib --mode package

# Get started in 3 steps
cd my-agent
npm install
cp .env.example .env   # edit .env and set OPENAI_API_KEY
npm run dev
```

No global install required — `npx` always fetches the latest version.

## Commands

| Command | Description |
|---|---|
| `agent create <name>` | Scaffold a new Agent project |
| `agent dev` | Start the generated project's dev server (CLI chat or Next.js dev) |
| `agent validate [structure\|security\|env\|runtime]` | Validate structure or a focused production concern |
| `agent trace` | Inspect Agent execution traces |
| `agent add skill <name>` | Add a skill skeleton and auto-register it |
| `agent add guard <name>` | Add a guard skeleton and auto-register it |
| `agent add workflow <name>` | Add a workflow skill skeleton and auto-register it |
| `agent version` | Print CLI version |
| `agent help` | Print CLI help |

## `agent create` Options

```
agent create <name> [options]
```

| Option | Default | Description |
|---|---|---|
| `--mode <mode>` | `service` | Generation mode: `package` or `service` |
| `--capability <name>` | `agent-core` | Capability template to use |
| `--package-manager <pm>` | `npm` | Package manager for install instructions |
| `--force` | `false` | Overwrite a matching Agent Creator-owned directory |

Project names must be safe, lowercase, non-scoped npm names. `--force` refuses to remove directories without a matching `.agent-creator.json` ownership marker.

## Package vs Service Mode

### `--mode package`

Generates a **TypeScript library + CLI chat** project. Best when you want to:

- Embed the Agent inside another Node.js / TypeScript process
- Publish the Agent as an npm package for others to consume
- Run interactive CLI chat for local development

```
my-agent/
├── agent.config.ts          # Agent configuration
├── src/
│   ├── index.ts             # Agent entrypoint (getAgent / runAgent)
│   ├── cli.ts               # Interactive CLI chat
│   ├── client.ts            # HTTP client helpers
│   ├── dev.ts               # Dev entrypoint
│   ├── env.ts               # .env loader
│   ├── skills/index.ts      # Skill registry
│   └── guards/index.ts      # Guard registry
├── tests/
│   └── agent.test.ts
└── docs/
    ├── api.md
    └── skill-authoring.md
```

Usage:

```bash
npm run dev        # interactive CLI chat
npm run build      # compile TypeScript
npm test           # run tests
```

```ts
// Import from another module
import { runAgent } from 'my-agent';

const output = await runAgent({
  input: 'Summarize today\'s tickets',
  sessionId: 'session-1',
});
```

### `--mode service`

Generates a **Next.js web app + HTTP API** project. Includes everything in `package` mode, plus:

- Next.js App Router with `/api/agent`, `/api/agent/stream`, `/api/agent/health`
- A React chat UI (`src/components/AgentChat.tsx`)
- Bearer-token auth that requires `AGENT_API_KEY` in production
- Streaming NDJSON progress endpoint

```
my-agent/
├── ...(all package mode files)...
├── src/app/
│   ├── page.tsx                        # Web chat UI
│   ├── api/agent/
│   │   ├── route.ts                    # POST /api/agent
│   │   ├── auth.ts                     # Bearer token auth
│   │   ├── health/route.ts             # GET /api/agent/health
│   │   └── stream/route.ts             # POST /api/agent/stream (NDJSON)
│   └── layout.tsx                      # Next.js root layout
└── next.config.ts
```

Usage:

```bash
npm run dev        # Next.js dev server → open http://localhost:3000
npm run dev:agent  # CLI chat (parallel debug entrypoint)
npm run build && npm start  # production
```

## Environment Variables (.env)

The generated project reads model config from environment variables through `agent.config.ts`. Copy `.env.example` to `.env` and fill in the values:

```bash
# Required — LLM provider endpoint
LLM_BASE_URL=https://api.openai.com/v1

# Required — API key for the LLM provider
OPENAI_API_KEY=sk-your-key-here

# Optional — model name (defaults to gpt-4o-mini)
LLM_MODEL=gpt-4o-mini
```

### Service-mode extras

```bash
# Required in production — HTTP callers send Authorization: Bearer <this-value>
AGENT_API_KEY=replace-with-a-random-secret

# Optional — target URL for the built-in webhook skill
WEBHOOK_URL=https://hooks.example.com/agent
```

The generated `agent.config.ts` reads these variables at runtime:

```ts
model: {
  baseUrl: process.env.LLM_BASE_URL ?? '',
  apiKey: process.env.OPENAI_API_KEY ?? '',
  model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
  timeoutMs: 30000,
  maxRetries: 1,
},
```

You can also hardcode values directly in `agent.config.ts` if you prefer.

## Adding Skills

```bash
agent add skill calendar
```

Generates `src/skills/calendar.ts` with Zod-validated input/output schemas, and **auto-registers** it in:
- `src/skills/index.ts` — import + skill array
- `agent.config.ts` — `skills.enabled` array

Generated skill skeleton:

```ts
import { z } from 'zod';
import type { Skill } from '@agent-creator/core';

const inputSchema = z.object({
  query: z.string().min(1).describe('The user or workflow request.'),
  options: z.record(z.string(), z.unknown()).optional(),
});

const outputSchema = z.object({
  ok: z.boolean(),
  result: z.string(),
  warnings: z.array(z.string()).optional(),
});

export const calendarSkill: Skill<...> = {
  name: 'calendar',
  description: 'Generated domain skill skeleton.',
  inputSchema,
  outputSchema,
  permission: 'public',
  timeoutMs: 30000,
  retry: 0,
  async execute(input) {
    // Replace with your business logic
    return { ok: true, result: `Handled ${input.query}` };
  },
};
```

Invoke a Skill from trusted server code:

```ts
import { invokeSkill } from './src/index.js';

await invokeSkill({
  skill: 'calendar',
  input: { query: 'tomorrow\'s events' },
});
```

`runAgent()` does not interpret `metadata.skill`. Restricted Skills also pass through core permission checks.

### Built-in Webhook Skill

```bash
agent add skill webhook
```

Adds a pre-built webhook adapter. Set `WEBHOOK_URL` in `.env`, then call it:

```ts
await invokeSkill({
  skill: 'webhook',
  input: { event: 'build.completed', message: 'Build finished' },
});
```

The webhook Skill is `external_api` and remains blocked until the generated runtime registers an explicit `SkillAuthorizer`.

## Adding Guards

```bash
agent add guard domain-policy
```

Generates `src/guards/domain-policy.ts` and auto-registers it in `src/guards/index.ts` and `agent.config.ts`. Guards run **before** skills — use them to enforce domain boundaries, permissions, or safety checks:

```ts
import type { Guard } from '@agent-creator/core';

export const domainPolicyGuard: Guard = {
  async check(context) {
    const input = context.input.input.trim();
    if (!input) {
      return { allowed: false, reason: 'Input is required.' };
    }
    const blockedPatterns: RegExp[] = [
      // Add domain-specific block patterns
      // /delete\s+all/i,
    ];
    if (blockedPatterns.some(p => p.test(input))) {
      return { allowed: false, reason: 'Outside allowed domain.' };
    }
    return { allowed: true };
  },
};
```

Guards are composed in `src/guards/index.ts` — all guards must pass before any skill executes.

## Adding Workflows

```bash
agent add workflow customer-onboarding
```

Generates `src/skills/customer-onboarding-workflow.ts` and auto-registers it as both a skill and a workflow. Workflows are **Skills tagged with `workflow`** — they execute multi-step domain tasks:

```ts
export const customerOnboardingWorkflow: Skill<...> = {
  name: 'customer.onboarding',
  description: 'Generated workflow skill skeleton for multi-step domain work.',
  inputSchema: z.object({
    goal: z.string().min(1),
    steps: z.array(z.string().min(1)).min(1),
  }),
  tags: ['workflow'],
  async execute(input, context) {
    // Iterate through steps, track status, return summary
  },
};
```

Call a workflow just like a skill:

```ts
await invokeSkill({
  skill: 'customer.onboarding',
  input: {
    goal: 'Onboard Acme Corp',
    steps: ['Verify account', 'Create workspace', 'Send welcome email'],
  },
});
```

## HTTP API (Service Mode)

When using `--mode service`, the project exposes these endpoints:

### POST /api/agent

Run the Agent synchronously and get the final output.

```bash
curl -X POST http://localhost:3000/api/agent \
  -H "content-type: application/json" \
  -d '{"input":"Hello agent","sessionId":"demo"}'
```

```json
{
  "success": true,
  "intent": "generate_response",
  "message": "Hello! How can I help you?",
  "data": {},
  "requestId": "request_abc123",
  "traceId": "trace_abc123"
}
```

### POST /api/agent/stream

Run the Agent with streaming NDJSON progress events.

```bash
curl -N -X POST http://localhost:3000/api/agent/stream \
  -H "content-type: application/json" \
  -d '{"input":"Hello agent","sessionId":"demo"}'
```

Each line is a JSON event:

```json
{"type":"progress","event":{"type":"agent.started","message":"Agent started","traceId":"trace_abc123","at":"..."}}
{"type":"progress","event":{"type":"skill.started","message":"Running calendar","traceId":"trace_abc123","at":"..."}}
{"type":"final","output":{"success":true,"intent":"skill_response","message":"Done","traceId":"trace_abc123"}}
```

### GET /api/agent/health

```bash
curl http://localhost:3000/api/agent/health
```

```json
{
  "ok": true,
  "name": "my-agent",
  "version": "0.7.0",
  "service": { "enabled": true, "framework": "next" },
  "model": {
    "configured": true,
    "baseUrlConfigured": true,
    "apiKeyConfigured": true,
    "model": "gpt-4o-mini"
  }
}
```

### TypeScript HTTP Client

The generated project includes `src/client.ts` for calling the service from other TypeScript / Node.js code:

```ts
import { runAgentHttp, streamAgentHttp } from './src/client.js';

// One-shot request
const output = await runAgentHttp({
  baseUrl: 'http://localhost:3000',
  input: 'Hello agent',
  sessionId: 'demo',
  apiKey: 'your-agent-api-key',
});

// Streaming request
for await (const event of streamAgentHttp({
  baseUrl: 'http://localhost:3000',
  input: 'Show progress',
  sessionId: 'demo',
})) {
  if (event.type === 'progress') console.log('…', event.event.message);
  if (event.type === 'final') console.log('✓', event.output.message);
}
```

## Trace Inspection

Every Agent run produces a trace. Inspect them from the project root:

```bash
# Show the latest trace
agent trace --latest

# List all trace IDs
agent trace --list

# Show a specific trace
agent trace --id trace_abc123
```

Development traces are stored in `.agent-traces/` as redacted, versioned JSON files. Send `x-request-id` to correlate an HTTP request with progress events, final output, and Trace.

## Validation

Verify that a generated project is structurally sound:

```bash
agent validate
agent validate security
agent validate env
agent validate runtime
```

Checks for:
- Required files (`agent.config.ts`, `package.json`, `src/index.ts`, `src/skills/index.ts`)
- Config schema validity
- Skills/guards/workflows registered in both config and index files
- Duplicate skill/guard/workflow names
- Service-mode specific files and dependencies
- `@agent-creator/core` dependency presence

`security` checks fail-closed production auth, runtime mode, persistent Memory, and restricted Skill authorization. `env` checks deployment variables. `runtime` builds the Agent without calling a real model.

Configuration is parsed statically. `agent validate` supports literals and `process.env.NAME ?? fallback`, but rejects calls, spreads, computed properties, imports used as values, and other executable expressions.

## Project Structure After `agent create`

### Package mode

```
my-agent/
├── agent.config.ts
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts          # getAgent(), runAgent(), re-exports
│   ├── cli.ts            # Interactive CLI chat loop
│   ├── client.ts         # HTTP client (runAgentHttp, streamAgentHttp)
│   ├── dev.ts            # Dev entrypoint
│   ├── env.ts            # .env loader
│   ├── skills/
│   │   └── index.ts      # Skill registry
│   └── guards/
│       └── index.ts      # Guard registry (composite guard)
├── tests/
│   └── agent.test.ts
└── docs/
    ├── api.md
    └── skill-authoring.md
```

### Service mode

Same as package mode, plus:

```
my-agent/
├── next.config.ts
├── src/
│   └── app/
│       ├── page.tsx                          # Web chat UI
│       ├── layout.tsx                        # Root layout with Ant Design
│       ├── api/agent/
│       │   ├── route.ts                      # POST /api/agent
│       │   ├── auth.ts                       # Bearer token auth
│       │   ├── health/route.ts               # GET /api/agent/health
│       │   └── stream/route.ts               # POST /api/agent/stream
│       └── components/
│           └── AgentChat.tsx                  # React chat component
```

## Full Example: From Zero to Web Chat

```bash
# 1. Scaffold
npx @agent-creator/cli create support-bot --mode service

# 2. Configure
cd support-bot
cp .env.example .env
# Edit .env → set OPENAI_API_KEY, LLM_BASE_URL

# 3. Add custom skills
agent add skill ticket-search
agent add skill knowledge-base

# 4. Add a guard for domain safety
agent add guard support-policy

# 5. Add a workflow for multi-step resolution
agent add workflow ticket-triage

# 6. Validate everything is wired correctly
agent validate

# 7. Run
npm install
npm run dev
# Open http://localhost:3000 and chat with your Agent

# 8. Call the API
curl -X POST http://localhost:3000/api/agent \
  -H "content-type: application/json" \
  -d '{"input":"Find open tickets for customer Acme","sessionId":"demo"}'
```
