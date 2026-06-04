# Testing

## Root Project Tests

Root tests cover:

- Template registry
- Create command
- Validate command

The root Vitest config excludes `demo-agent/**` and `src/templates/**/files/**` so local generated acceptance projects and physical template test files do not become part of the root test suite.

Run:

```bash
npm test
```

## Generated Project Tests

Generated projects include tests for:

- Config schema
- Tool registry
- Weather tool
- Math tool
- Orchestrator paths

Run inside a generated project:

```bash
npm install
npm run build
npm test
```

## Full Acceptance

```bash
npm install
npm run build
npm test
npm link
agent create demo-agent
cd demo-agent
npm install
npm run build
npm test
npm run dev
agent validate
agent trace --latest
```
