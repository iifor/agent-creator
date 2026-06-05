# Testing

## Workspace

```bash
npm test
npm run build:plain
npm run check:package
```

The workspace suite runs:

- core Builder, Provider, Skill, module override, and Tool compatibility tests
- CLI creation, validation, Skill generation, capability, version, and dependency tests
- root release and commit script tests

## Consumer Acceptance

Pack or install the local `packages/core` into generated package and service projects.

Package acceptance requires `npm test` and `npm run build`.

Service acceptance requires `npm test` and `npm run build`; model credentials are not required at build time because Agent construction is lazy.
