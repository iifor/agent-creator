# Testing

## Root Project Tests

Root tests cover:

- Capability registry
- Create command
- Validate command

The root TypeScript build and Vitest config exclude generated acceptance projects and `src/capabilities/**/files/**` because physical capability files may contain unreplaced placeholders. Generated projects compile those files after placeholder replacement.

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

Generated service Agent acceptance:

```bash
node dist/src/index.js create demo-agent --force
cd demo-agent
npm install
npm run build
npm test
agent validate
```

Generated projects use `next build`; `npm run dev:agent` is available for CLI-only debugging.

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
