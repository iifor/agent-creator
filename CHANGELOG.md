# Changelog

All notable changes to Agent Creator are recorded here.

## 0.1.0 - 2026-06-04

### Added

- Added forced build-time version bumping through `npm run build -- --release <type>`.
- Added Conventional Commit enforcement through a Husky `commit-msg` hook.
- Added `tool-agent` project generation.
- Added CLI commands: `create`, `validate`, `dev`, `trace`, `add tool`, `version`, and `help`.
- Added generated runtime with mock LLM, mock tools, guard, planner, executor, output validator, error recovery, trace logging, tests, and examples.
- Added docs-first maintenance system under `docs/`.
- Added layered version metadata for generated projects: `configVersion`, `templateVersion`, and `generatedBy`.
- Generated project README now records Agent Creator, template, and config schema versions.

### Changed

- Moved `tool-agent` generation from large inline strings to physical template files.
- `agent validate` now loads generated config and checks schema/config version compatibility.

### Docs

- Added versioning, maintenance, architecture, CLI, template, runtime, trace, testing, and AI handoff documentation.
