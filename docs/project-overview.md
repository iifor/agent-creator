# Project Overview

Agent Creator provides a stable npm Agent runtime and a CLI for creating thin consumer projects.

## Positioning

`@agent-creator/core` owns reusable Agent behavior. Applications decide whether that runtime becomes a todo Agent, workflow Agent, RAG Agent, customer-service Agent, or another product by registering Skills and replacing runtime modules.

## Packages

- `packages/core`: published as `@agent-creator/core`.
- `packages/cli`: published as `@agent-creator/cli` with the `agent` binary.
- Generated package projects: reusable business Agents that depend on core.
- Generated service projects: the same business Agent plus a Next.js UI/API shell.

## Core Guarantees

- Explicit OpenAI-compatible model configuration.
- Builder-based registration for Skill, Memory, Planner, Executor, Model, Guard, and Trace modules.
- Default minimal runtime modules with no example Skills.
- Schema validation for Skill input and output.
- One-version compatibility adapters for legacy Tool APIs.

## Future Direction

Workflow, RAG, todo, and multi-Agent features should ship as Skills or module packages rather than templates.
