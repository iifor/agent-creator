# Architecture

Agent Creator has two layers:

1. The root CLI project.
2. The generated Agent project.

## Root CLI

The CLI entrypoint is `src/index.ts`, which delegates to `src/cli/cli.ts`.

Commands live in `src/commands/`:

- `create.ts`
- `validate.ts`
- `dev.ts`
- `trace.ts`
- `addTool.ts`

Shared helpers live in `src/utils/`, schemas in `src/schemas/`, and public internal types in `src/types/`.

## Template System

Templates are registered in `src/templates/templateRegistry.ts`.

v0.1 registers only `tool-agent`. The generated files are produced by `src/templates/tool-agent/generatedFiles.ts`.

## Generated Runtime

The generated `tool-agent` runtime follows a small pipeline:

```txt
input -> inputAnalyzer -> intentRouter -> guard -> planner -> executor -> outputValidator -> traceLogger -> AgentOutput
```

The runtime is intentionally lightweight. Extension points exist, but v0.1 avoids framework-level complexity.
