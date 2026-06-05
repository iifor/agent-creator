# Changelog

All notable changes to Agent Creator are recorded here.

## 0.1.0 - 2026-06-04

### Added

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

- Moved `typescript` to production dependencies because `agent validate` uses it at CLI runtime.
- Moved `agent-core` generation from large inline strings to physical capability files.
- `agent validate` now loads generated config and checks schema/config version compatibility.

### Docs

- Added versioning, maintenance, architecture, CLI, capability, runtime, trace, testing, and AI handoff documentation.
