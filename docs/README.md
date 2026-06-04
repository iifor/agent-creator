# Docs

This directory is the source of truth for understanding Agent Creator.

## Read Order

1. `project-overview.md`
2. `architecture.md`
3. Pick the task-specific doc:
   - CLI behavior: `cli.md`
   - Templates: `template-system.md`
   - Generated runtime: `generated-agent-runtime.md`
   - Trace/debugging: `trace-and-debugging.md`
   - Tests: `testing.md`
   - Maintenance rules: `maintenance-rules.md`
   - AI handoff: `ai-handoff.md`

## AI Rule

AI agents must read docs first and only inspect task-relevant source files after that. Do not use a full-codebase scan as the first step for project understanding.

## Update Rule

When code changes alter project flow, module boundaries, key APIs, data structures, runtime config, workflows, CLI behavior, or important conventions, update the relevant docs in the same change.
