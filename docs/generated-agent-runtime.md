# Generated Agent Runtime

The generated `tool-agent` is a runnable TypeScript project.

## Flow

```txt
AgentInput
  -> analyzeInput
  -> routeIntent
  -> runGuard
  -> createPlan
  -> executePlan
  -> validateOutput
  -> trace.end
  -> AgentOutput
```

## Key Modules

- `src/agent/orchestrator.ts`: owns the end-to-end run.
- `src/agent/inputAnalyzer.ts`: trims input, detects simple tool hints, records blocked keywords.
- `src/agent/intentRouter.ts`: maps analyzed input to `generate_response`, `call_tool`, `ask_clarification`, or `safe_redirect`.
- `src/agent/guard.ts`: blocks unsafe keywords and unsupported intents.
- `src/agent/planner.ts`: creates a lightweight plan.
- `src/agent/executor.ts`: runs tool, llm, memory, or guard steps.
- `src/agent/toolRegistry.ts`: registers and executes tools with zod validation.
- `src/agent/outputValidator.ts`: guarantees a standard `AgentOutput`.
- `src/traces/traceLogger.ts`: records trace data.

## Core Data

`AgentInput`:

```ts
{
  input: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}
```

`AgentOutput`:

```ts
{
  success: boolean;
  intent: string;
  message: string;
  data?: unknown;
  warnings?: string[];
  errors?: string[];
  traceId?: string;
}
```

## Defaults

- Model provider: `mockLLM`
- Tools: `weather.query`, `math.calculate`
- Trace directory: `.agent-traces`
- Math parser: safe tokenizer/parser, no `eval`

## Config Validation

`agent validate` loads the generated project's `agent.config.ts` default export and validates it with the root Agent Creator zod schema. The generated config must keep the documented `tool-agent` shape: `name`, `template`, `version`, `configVersion`, `templateVersion`, `generatedBy`, `model`, `tools`, `constraints`, and `trace`.

Version fields:

```ts
{
  version: '0.1.0',
  configVersion: '0.1',
  templateVersion: '0.1.0',
  generatedBy: {
    name: 'agent-creator',
    version: '0.1.0',
  }
}
```

`configVersion` must be supported by the current CLI. Unsupported config versions fail validation with upgrade guidance.

The generated project README also records the Agent Creator CLI version, template version, and config schema version used at creation time.
