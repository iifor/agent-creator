# Versioning

Agent Creator uses layered versioning so CLI releases, generated capabilities, and generated config compatibility do not get mixed together.

## SemVer

The root package follows `MAJOR.MINOR.PATCH`.

- `PATCH`: bug fixes, docs, internal refactors, and compatible validation improvements.
- `MINOR`: compatible new features, commands, capabilities, or optional config fields.
- `MAJOR`: breaking CLI behavior, incompatible capability structure, or unsupported config schema changes.

During `0.x`:

- `0.1.x`: stabilize the current `agent-core` loop.
- `0.2.x`: add `add guard` and `add workflow`.
- `0.3.x`: add real LLM providers.
- `0.4.x`: add RAG and multi-agent modules.
- `1.0.0`: stabilize CLI, capability system, config schema, and trace format.

## Version Layers

- CLI package version: root `package.json` `version`.
- Capability version: generated `agent.config.ts` `capabilityVersion`.
- Config schema version: generated `agent.config.ts` `configVersion`.
- Generated runtime version: generated `agent.config.ts` `generatedBy.version`.

`agent version` and `agent --version` must read from root `package.json` through `src/version.ts`.

## Supported Config Versions

Supported config versions are declared in `src/version.ts`.

`agent validate` must reject unsupported `configVersion` values with repair guidance. v0.1 does not auto-migrate configs; future versions may add `agent migrate`.

## Git and Commit Rules

- Main branch: `main`
- Feature branch: `feat/<short-name>`
- Fix branch: `fix/<short-name>`
- Release tag: `vX.Y.Z`
- Prerelease tag: `vX.Y.Z-alpha.N`

Use Conventional Commits:

- `feat:` for new behavior
- `fix:` for bugs
- `docs:` for docs
- `test:` for tests
- `refactor:` for structure changes
- `chore:` for tooling and maintenance
- `BREAKING CHANGE:` for incompatible changes

Commit messages are enforced by `.husky/commit-msg`, which calls `scripts/check-commit-msg.mjs`.

`agent commit` provides an interactive type selector and builds a valid Conventional Commit message for already staged changes.

Allowed commit types are:

- `feat`
- `fix`
- `hotfix`
- `docs`
- `test`
- `refactor`
- `chore`
- `build`
- `ci`
- `perf`
- `revert`

Examples:

```txt
feat: add workflow command
fix(cli): handle invalid capability
refactor!: change generated config compatibility
```

## Forced Build Versioning

`npm run build` is a versioned build and must declare release intent:

```bash
npm run build -- --release fix
npm run build -- --release hotfix
npm run build -- --release feat
npm run build -- --release breaking
```

Release mapping:

- `fix` / `hotfix` -> patch
- `feat` -> minor
- `breaking` -> major

`npm run build` without `--release` fails. Internal validation may use `npm run build:plain` when it must compile without changing versions.

## Release Process

Before a release:

```bash
npm run build -- --release fix
npm test
node dist/src/index.js create demo-agent --force
cd demo-agent
npm run build
npm test
node ../dist/src/index.js validate
```

Release dependency rule:

- Any package statically imported by `src/**/*.ts` at runtime must be listed in `dependencies`, not only `devDependencies`.
- The test suite includes a runtime dependency guard to catch missing published-package dependencies before npm release.
- `npm pack --dry-run` should show only the publish allowlist, not source tests or stale `dist` artifacts.
- The `prepare` script installs Husky when possible but must not block npm packing/publishing in restricted environments.
- `npm run check:package` enforces the publish allowlist and fails if source, tests, demo projects, traces, or local config files enter the tarball.

Publish commands:

```bash
npm run publish
npm run publish:beta
```

Both publish commands run `build:plain`, tests, package content checks, and then `npm publish --access public --tag <tag>`.

Release steps:

1. Run `npm run build -- --release <type>` to bump versions and compile.
2. Ensure `src/version.ts` derives CLI and capability versions correctly.
3. Update `CHANGELOG.md`.
4. Update affected docs.
5. Commit using a Conventional Commit message.
6. Create a Git tag such as `v0.1.0`.

## Changelog Format

```md
## 0.1.1 - YYYY-MM-DD

### Fixed
- ...

### Changed
- ...

### Docs
- ...
```
