# Capability System

The CLI currently registers one project capability: `agent-core`.

`packages/cli/src/capabilities/agent-core/files/base` contains the thin package project. The service overlay adds Next.js UI and API files.

The loader merges the base and service file sets and replaces project, CLI, config, capability, and core version placeholders.

Generated projects include `.agent-creator.json` ownership metadata. The CLI requires this marker and a matching project name before `create --force` may remove an existing target.

The capability selects project shape only. Business behavior is composed from `@agent-creator/core` Skills and runtime modules.

The base project includes extension registries for:

- `src/skills/index.ts` for Skills and workflow Skills.
- `src/guards/index.ts` for locally composed Guards.
- `agent.config.ts` metadata for enabled Skills, Guards, and Workflows.

RAG, workflow, guard, and multi-Agent features should continue to ship as generated modules, Skills, Guards, or external packages instead of expanding the capability into a large business template.
