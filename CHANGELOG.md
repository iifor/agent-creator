# Changelog

All notable changes to Agent Creator are recorded here.

## Unreleased

## 0.7.0 - 2026-06-11

### Added

- Added versioned `0.1` Trace documents with request correlation, module timing, model usage, authorization decisions, Skill attempts, structured errors, and redacted output summaries.
- Added `FileTraceProvider`; generated development projects now write `.agent-traces` for immediate `agent trace` use.
- Added `agent validate security`, `agent validate env`, and `agent validate runtime`.
- Added `StructuredSkillPlanner` with one candidate action, generated Skill JSON schemas, allowlist checks, Zod input validation, Executor authorization, and evaluation metrics.
- Added package repository, license, bugs, homepage, and security policy metadata.

### Changed

- **Breaking:** Memory messages now use the OpenAI-compatible `assistant` role; `agent` is no longer accepted.
- **Breaking:** `Agent.run()` no longer treats `metadata.skill` as a direct invocation channel. Trusted code uses `Agent.invokeSkill()`.
- **Breaking:** Skill permissions are enforced for Planner and direct execution, and `external_api` Skills require an explicit `SkillAuthorizer`.
- **Breaking:** Skill retries require `idempotent: true`; Skill contexts now receive execution IDs, attempt numbers, idempotency keys, and an AbortSignal.
- Production runtime mode requires an explicit MemoryProvider instead of silently using process-local memory.
- Generated projects pin the exact core version, require API authentication in production, and reject executable config during validation.
- `agent create --force` only overwrites matching Agent Creator-owned directories.
- HTTP services propagate `x-request-id` through response headers, progress events, outputs, and Trace documents.
- `ModelSkillPlanner` is deprecated and retained for one minor compatibility release.
- Pre-1.0 breaking releases now increment the minor version; breaking releases increment major from 1.x.

### Security

- Trace persistence recursively redacts sensitive keys and does not store raw prompt, metadata, authorization, API key, or Skill input/output by default.
- Focused security validation uses TypeScript AST checks for actual Memory and Skill authorizer registration.

## 0.1.0 - 2026-06-04

### Added

- Added Terser minification for published workspace JavaScript build output while leaving generated project templates readable.
- Added the publishable `@agent-creator/core` workspace package.
- Added a Builder API for Skills, Memory, Planner, Executor, Model, Guard, and Trace modules.
- Added required OpenAI-compatible `baseUrl`, `apiKey`, and `model` configuration.
- Added `agent add skill`; `agent add tool` remains as a deprecated compatibility alias.
- Added `npm run commit` for Agent Creator maintainers with interactive Conventional Commit type selection.
- Generated projects are now service-style Agents by default with Next.js API routes, antd chat UI, and trace viewer.
- Generated projects keep `npm run dev:agent` for CLI debugging while `npm run dev` starts Next.js.
- Replaced generated mock LLM with a real OpenAI-compatible provider that requires user configuration.
- Updated package content checks for the base/service capability overlay layout.
- Added publish package allowlist and build clean step to avoid stale or test artifacts in npm tarballs.
- Added `publish`, `publish:beta`, and `check:package` scripts to enforce npm package contents before publishing.
- Removed compiled root test files from published npm tarballs.
- Made Husky prepare non-blocking for restricted npm pack/publish environments.
- Added a runtime dependency guard test so published CLI imports must exist in production dependencies.
- Added forced build-time version bumping through `npm run build -- --release <type>`.
- Added Conventional Commit enforcement through a Husky `commit-msg` hook.
- Added `agent-core` project generation.
- Added CLI commands: `create`, `validate`, `dev`, `trace`, `add tool`, `version`, and `help`.
- Added generated runtime with initial mock LLM, local example tools, guard, planner, executor, output validator, error recovery, trace logging, tests, and examples.
- Added docs-first maintenance system under `docs/`.
- Added layered version metadata for generated projects: `configVersion`, `capabilityVersion`, and `generatedBy`.
- Generated project README now records Agent Creator, capability, and config schema versions.

### Changed

- Converted generated package and service projects into thin consumers of `@agent-creator/core`.
- Split the repository into npm workspace packages for core and CLI.
- Moved `typescript` to production dependencies because `agent validate` uses it at CLI runtime.
- Moved `agent-core` generation from large inline strings to physical capability files.
- `agent validate` now loads generated config and checks schema/config version compatibility.

### Docs

- Added versioning, maintenance, architecture, CLI, capability, runtime, trace, testing, and AI handoff documentation.
