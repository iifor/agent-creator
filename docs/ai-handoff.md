# AI Handoff

You are working in a docs-first project.

## Before Editing

Read:

1. `docs/README.md`
2. `docs/project-overview.md`
3. The doc relevant to the task

Do not begin by globally scanning all code.

## Decision Discipline

Do not act as a blind executor for every proposed implementation. Treat user ideas as proposals to assess.

Before editing, consider:

- Whether the proposal fits the architecture and public API direction.
- Whether it creates security, runtime, compatibility, or maintenance risk.
- Whether the benefit justifies the added complexity.
- Whether a simpler alternative would satisfy the same goal.
- Which tests and docs must change if the work proceeds.

When the proposal is risky or misaligned, explain the concern and recommend a better path before implementation.

## Common Task Map

- Core runtime change: read `docs/architecture.md`, then `packages/core/src/`.
- CLI change: read `docs/cli.md`, then `packages/cli/src/cli/cli.ts` and the relevant command file.
- Capability change: read `docs/capability-system.md`, then `packages/cli/src/capabilities/agent-core/`.
- Generated project change: read `docs/generated-agent-runtime.md`, then the capability files.
- Trace change: read `docs/trace-and-debugging.md`, then trace command and generated trace modules.
- Test change: read `docs/testing.md`, then focused tests.

## After Editing

If you changed project flow, module boundaries, APIs, data structures, runtime config, workflows, trace behavior, tests, or conventions, update the relevant docs and `todo.md`.
