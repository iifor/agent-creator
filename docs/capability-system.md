# Capability System

The CLI currently registers one project capability: `agent-core`.

`packages/cli/src/capabilities/agent-core/files/base` contains the thin package project. The service overlay adds Next.js UI and API files.

The loader merges the base and service file sets and replaces project, CLI, config, capability, and core version placeholders.

The capability selects project shape only. Business behavior is composed from `@agent-creator/core` Skills and runtime modules.
