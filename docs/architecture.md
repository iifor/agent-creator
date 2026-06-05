# Architecture

## Workspace

The repository uses npm workspaces:

```txt
packages/core
packages/cli
```

The root package is private and coordinates build, test, packaging, versioning, commits, and publishing.

## Core Runtime

`createAgent({ model })` returns an `AgentBuilder`. The Builder starts with default Memory, Planner, Executor, Guard, Trace, and OpenAI-compatible Model modules.

Registration methods replace singleton modules using last-registration-wins semantics. Skill names are unique and duplicate registration fails.

`build()` captures the configured runtime and returns an `Agent` exposing `run(input)`.

```txt
AgentInput
  -> Guard
  -> Planner
  -> Executor
  -> Skill or Model
  -> Memory
  -> Trace
  -> AgentOutput
```

## CLI And Generation

The CLI source lives under `packages/cli/src`.

Generated projects contain:

- `agent.config.ts`
- `src/index.ts`
- `src/skills/`
- tests and package metadata
- optional Next.js files in service mode

They import runtime behavior from `@agent-creator/core`; runtime implementation files are not copied.
