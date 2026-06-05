# Agent Creator

Agent Creator is a docs-first CLI for generating runnable, testable Agent applications.

It is not a chatbot generator and not a prompt collection. v0.1 focuses on one reliable loop: create an `agent-core` capability, run it locally, test it, validate it, inspect traces, and add tools.

## Docs-First Rule

AI agents and developers must understand this project through `docs/` first.

Required reading order:

1. `docs/README.md`
2. `docs/project-overview.md`
3. The task-specific docs page
4. Only the code files relevant to the task

Do not start by globally scanning the codebase to infer the architecture.

If a change modifies project flow, module boundaries, key APIs, data structures, runtime config, workflows, or important conventions, update `docs/` in the same change.

## Commands

```bash
npm install
npm run build -- --release fix
npm test
npm link
npm run check:package
npm run publish:beta
npm run commit

agent create demo-agent
cd demo-agent
npm install
npm run dev
agent validate
agent trace --latest
agent add tool calendar
agent version
agent help
```

## v0.1 Scope

- CLI: `create`, `validate`, `dev`, `trace`, `add tool`
- Capability: `agent-core`
- Runtime: OpenAI-compatible LLM provider, local example tools, guard, planner, executor, output validator, error recovery, trace
- Docs: project knowledge entrypoint for humans and AI

Deferred: richer model providers, additive RAG/workflow/multi-agent modules, Web Dev Console, plugin marketplace, `add guard`, and `add workflow`.
