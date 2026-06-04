# Template System

The template system is intentionally small in v0.1.

## Registry

`src/templates/templateRegistry.ts` maps template names to template definitions.

Only `tool-agent` is registered.

## Tool Agent Template

`src/templates/tool-agent/files/` contains the physical generated project template.

`src/templates/tool-agent/fileTemplate.ts` recursively reads those files and replaces placeholders such as `{{projectName}}`, `{{cliVersion}}`, `{{configVersion}}`, and `{{templateVersion}}`.

The root build copies template files into `dist/src/templates/tool-agent/files/` through `scripts/copy-templates.mjs`, so the compiled CLI can generate projects without reading from source paths.

## Template Versioning

Generated projects include `templateVersion`, `configVersion`, and `generatedBy.version` in `agent.config.ts`.

- `templateVersion` tracks the generated `tool-agent` template version.
- `configVersion` controls validation compatibility.
- `generatedBy.version` records the Agent Creator CLI version that created the project.

Template or config version changes require updates to `docs/versioning.md`, `docs/generated-agent-runtime.md`, and `CHANGELOG.md`.

## Extension Contract

A template must provide:

- `name`
- `description`
- `files(projectName)`, which may return files synchronously or asynchronously

Adding a template requires updating:

- `src/templates/templateRegistry.ts`
- `docs/template-system.md`
- `docs/project-overview.md`
- tests for template registration
