# CLI

The binary command is `agent`.

## `agent create <name>`

Creates a generated Agent project.

Options:

- `--capability <capability>` defaults to `agent-core`
- `--package-manager <packageManager>` defaults to `npm`
- `--force` overwrites an existing target directory

Only `agent-core` is supported in v0.1. Unsupported capabilities return a clear error in Chinese explaining that RAG, workflow, guard, and similar features are additive modules or commands.

Generated projects are service-style Agent projects by default: core-backed Agent integration, a Next.js API route, and an antd chat UI.
Generated projects depend on `@agent-creator/core` and contain only configuration, Skills, integration code, tests, and the optional service shell.

## `agent validate`

Validates that the current directory looks like a generated Agent project.

It checks required files, transpiles and loads `agent.config.ts`, validates the default export with the root zod `AgentConfig` schema, and verifies that configured tools have matching tool files.

If config loading fails, confirm that `agent.config.ts` has a valid default export and only uses config-time imports that can be resolved during validation.

## `agent version`

Prints the Agent Creator CLI version.

The native Commander flag `agent --version` is also supported.

## `agent help`

Prints Agent Creator CLI help.

The native Commander flag `agent --help` is also supported.

## `agent dev`

Runs `npm run dev` in a generated Agent project. Generated projects start `next dev`; use `npm run dev:agent` inside the generated project for CLI debugging.

## `agent trace`

Reads `.agent-traces`.

Options:

- `--latest` shows the newest trace
- `--list` lists trace IDs
- `--id <traceId>` shows one trace

This command remains for compatibility with projects that configure a file-backed Trace provider.

## `agent add skill <skillName>`

Adds a typed `Skill` skeleton under `src/skills`, registers it in `src/skills/index.ts`, and records it in `agent.config.ts`.

## `agent add tool <toolName>`

Deprecated compatibility alias for `agent add skill`.
