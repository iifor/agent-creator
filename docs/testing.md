# Testing

## Workspace

```bash
npm test
npm run build:plain
npm run check:package
```

`npm run build:plain` compiles both workspace packages and minifies their emitted JavaScript with Terser. Declaration files and generated project template files copied into the CLI package remain readable and unminified.

The workspace suite runs:

- core Builder, Provider, Skill, authorization, retry, abort, production memory, Trace/redaction, structured planning/evaluation, module override, and Tool compatibility tests
- CLI safe creation/overwrite, static/focused validation, Trace reading, Skill, Guard, Workflow generation, capability, version, and dependency tests
- root release and commit script tests

## Consumer Acceptance

Pack or install the local `packages/core` into generated package and service projects.

Package acceptance requires adding representative Skill, Guard, and Workflow scaffolds, then running `npm test` and `npm run build`.

Service acceptance requires `npm test` and `npm run build`; model credentials are not required at build time because Agent construction is lazy. Installed projects also run `agent validate`, `agent validate runtime`, and deployment checks with explicit environment fixtures.
