# Maintenance Rules

## Docs-First

AI agents and developers must read `docs/README.md` before inspecting source code for project understanding.

## Required Doc Updates

- CLI command, option, output, or error behavior changes require updates to `docs/cli.md`.
- Template structure or generated file changes require updates to `docs/template-system.md` and `docs/generated-agent-runtime.md`.
- Runtime flow changes require updates to `docs/generated-agent-runtime.md` and `docs/architecture.md`.
- Key type, schema, or config changes require updates to `docs/generated-agent-runtime.md`.
- Trace format or debugging behavior changes require updates to `docs/trace-and-debugging.md`.
- Test command or acceptance changes require updates to `docs/testing.md`.
- Task status changes require updates to `todo.md`.

## Code Conventions

- Keep modules focused and small.
- Do not use `eval`.
- Use zod for runtime validation.
- Use marker comments for generated project edits.
- Prefer explicit errors with repair guidance for CLI validation.

## AI Workflow

1. Read docs.
2. Identify task-specific modules from docs.
3. Read only relevant files.
4. Modify code.
5. Update docs and `todo.md` when required.
6. Run focused tests.
