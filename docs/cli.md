# CLI

The binary command is `agent`.

## `agent create <name>`

Creates a generated Agent project.

Options:

- `--capability <capability>` defaults to `agent-core`
- `--package-manager <packageManager>` defaults to `npm`
- `--force` overwrites an existing target directory

Only `agent-core` is supported in v0.1. Unsupported capabilities return a clear error in Chinese explaining that RAG, workflow, guard, and similar features are additive modules or commands.

Generated projects are service-style Agent projects by default: Agent runtime, Next.js API routes, antd chat UI, and trace viewer.

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

## `agent commit`

Creates a Conventional Commit from files already staged with Git.

By default it interactively asks for:

- commit type
- optional scope
- commit description

Supported types are `feat`, `fix`, `hotfix`, `docs`, `test`, `refactor`, `chore`, `build`, `ci`, `perf`, and `revert`.

Options:

- `--type <type>` skips the type prompt
- `--scope <scope>` sets an optional scope
- `--message <message>` skips the description prompt
- `--breaking` adds `!` before the colon

The command does not stage files automatically. It fails with repair guidance when run outside a Git repository or when no staged changes exist.

## `agent add tool <toolName>`

Adds a tool skeleton in a generated project.

Options:

- `--permission public`
- `--permission external_api`
- `--permission user_private`

The command updates:

- `src/tools/<tool-name>.ts`
- `src/tools/index.ts`
- `agent.config.ts`

It relies on marker comments to keep edits predictable.
