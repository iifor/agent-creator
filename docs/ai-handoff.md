# AI Handoff

You are working in a docs-first project.

## Before Editing

Read:

1. `docs/README.md`
2. `docs/project-overview.md`
3. The doc relevant to the task

Do not begin by globally scanning all code.

## Common Task Map

- CLI change: read `docs/cli.md`, then `src/cli/cli.ts` and the relevant command file.
- Capability change: read `docs/capability-system.md`, then `src/capabilities/agent-core/files/` and `src/capabilities/agent-core/fileLoader.ts`.
- Generated runtime change: read `docs/generated-agent-runtime.md`, then the relevant generated runtime function in the capability files.
- Trace change: read `docs/trace-and-debugging.md`, then trace command and generated trace modules.
- Test change: read `docs/testing.md`, then focused tests.

## After Editing

If you changed project flow, module boundaries, APIs, data structures, runtime config, workflows, trace behavior, tests, or conventions, update the relevant docs and `todo.md`.
