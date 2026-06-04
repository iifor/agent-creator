# Template System

The template system is intentionally small in v0.1.

## Registry

`src/templates/templateRegistry.ts` maps template names to template definitions.

Only `tool-agent` is registered.

## Tool Agent Template

`src/templates/tool-agent/generatedFiles.ts` returns the generated project files as in-memory `TemplateFile` objects.

This keeps v0.1 simple and makes tests fast. If the template grows too large, it can later move to physical template files with variable interpolation.

## Extension Contract

A template must provide:

- `name`
- `description`
- `files(projectName)`

Adding a template requires updating:

- `src/templates/templateRegistry.ts`
- `docs/template-system.md`
- `docs/project-overview.md`
- tests for template registration
