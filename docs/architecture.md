# Architecture

## Workspace

The repository uses npm workspaces:

```txt
packages/core
packages/cli
```

The root package is private and coordinates build, test, packaging, versioning, commits, and publishing.

## Core Runtime

`createAgent({ model, runtimeMode })` returns an `AgentBuilder`. The Builder starts with default Memory, Planner, Executor, Guard, Skill authorization, Trace, and OpenAI-compatible Model modules.

Registration methods replace singleton modules using last-registration-wins semantics. Skill names are unique and duplicate registration fails.

`build()` captures the configured runtime and returns an `Agent` exposing conversational `run(input)` and trusted server-side `invokeSkill(input)`. Production mode requires an explicitly registered MemoryProvider.

```txt
AgentInput
  -> Guard
  -> Planner
  -> Executor
  -> SkillAuthorizer
  -> Skill or Model
  -> Memory
  -> Trace
  -> AgentOutput
```

`StructuredSkillPlanner` is the preferred model-assisted router. It permits one candidate action (`model`, `skill`, or `none`) and validates model output against JSON structure, a Skill allowlist, the Skill input schema, and Executor authorization. `ModelSkillPlanner` is deprecated for removal after one minor release.

Trace documents use format version `0.1` and correlate `requestId` with the runtime `traceId`. Core records module durations, model usage, authorization decisions, Skill attempts, structured errors, and a final output summary without persisting raw prompts or Skill input/output.

## CLI And Generation

The CLI source lives under `packages/cli/src`.

Generated projects contain:

- `agent.config.ts`
- `src/index.ts`
- `src/skills/`
- tests and package metadata
- optional Next.js files in service mode
- `.agent-creator.json` ownership metadata used to constrain `create --force`

They import runtime behavior from `@agent-creator/core`; runtime implementation files are not copied.

Generated development runtimes register `FileTraceProvider` and write `.agent-traces`. Production runtimes must explicitly choose persistent Memory and Trace providers appropriate for their deployment.
