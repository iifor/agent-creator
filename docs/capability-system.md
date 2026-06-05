# Capability System

The capability system is intentionally small in v0.1.

## Registry

`src/capabilities/capabilityRegistry.ts` maps capability names to capability definitions.

Only `agent-core` is registered.

## Agent Core Capability

`src/capabilities/agent-core/files/base/` contains the physical generated project files shared by every generated Agent project.

`src/capabilities/agent-core/files/service/` contains the service layer that is always overlaid onto the base Agent runtime.

`src/capabilities/agent-core/fileLoader.ts` recursively reads base files, overlays service files by path, and replaces placeholders such as `{{projectName}}`, `{{cliVersion}}`, `{{configVersion}}`, `{{capabilityVersion}}`, and service flags.

The root build copies capability files into `dist/src/capabilities/agent-core/files/` through `scripts/copy-capabilities.mjs`, so the compiled CLI can generate projects without reading from source paths.

## Capability Versioning

Generated projects include `capabilityVersion`, `configVersion`, and `generatedBy.version` in `agent.config.ts`.

- `capabilityVersion` tracks the generated `agent-core` capability version.
- `configVersion` controls validation compatibility.
- `generatedBy.version` records the Agent Creator CLI version that created the project.

Capability or config version changes require updates to `docs/versioning.md`, `docs/generated-agent-runtime.md`, and `CHANGELOG.md`.

## Service Agent Shape

Generated projects are service-style Agents by default. The service layer adds Next.js, antd, chat UI, trace UI, and API routes on top of the same Agent runtime. Package mode omits that layer and keeps the same reusable runtime. LLM calls use a real OpenAI-compatible provider configured through environment variables. `npm run dev:agent` keeps a CLI debugging path available in service mode.

## Extension Contract

A capability must provide:

- `name`
- `description`
- `files(projectName)`, which may return files synchronously or asynchronously

Adding or changing a capability requires updating:

- `src/capabilities/capabilityRegistry.ts`
- `docs/capability-system.md`
- `docs/project-overview.md`
- tests for capability registration
