# CLI

The binary command is `agent`.

## `agent create <name>`

Creates a generated Agent project.

Options:

- `--template <template>` defaults to `tool-agent`
- `--package-manager <packageManager>` defaults to `npm`
- `--force` overwrites an existing target directory

Only `tool-agent` is supported in v0.1. Unsupported templates return a clear error in Chinese explaining later planned templates.

## `agent validate`

Validates that the current directory looks like a generated Agent project.

It checks required files, basic config shape, template value, and whether configured tools have matching tool files.

## `agent version`

Prints the Agent Creator CLI version.

The native Commander flag `agent --version` is also supported.

## `agent help`

Prints Agent Creator CLI help.

The native Commander flag `agent --help` is also supported.

## `agent dev`

Runs `npm run dev` in a generated Agent project. The generated project starts an interactive command-line console.

## `agent trace`

Reads `.agent-traces`.

Options:

- `--latest` shows the newest trace
- `--list` lists trace IDs
- `--id <traceId>` shows one trace

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
