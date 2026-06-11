# Versioning

Agent Creator uses layered versioning so CLI releases, generated capabilities, and generated config compatibility do not get mixed together.

## SemVer

The root package follows `MAJOR.MINOR.PATCH`.

- `PATCH`: bug fixes, docs, internal refactors, and compatible validation improvements.
- `MINOR`: compatible new features, commands, capabilities, or optional config fields.
- `MAJOR`: breaking CLI behavior, incompatible capability structure, or unsupported config schema changes after `1.0.0`.

During `0.x`:

- compatible features increment `MINOR`
- breaking releases also increment `MINOR`, because the leading zero already signals API instability
- `1.0.0` waits for stable public APIs, config schema, Trace format, and migration policy

## Version Layers

- Workspace coordination version: root `package.json` `version`.
- Core package version: `packages/core/package.json`.
- CLI package version: `packages/cli/package.json`.
- Capability version: generated `agent.config.ts` `capabilityVersion`.
- Config schema version: generated `agent.config.ts` `configVersion`.
- Generated runtime version: generated `agent.config.ts` `generatedBy.version`.

`agent version` and `agent --version` read from `packages/cli/package.json` through `packages/cli/src/version.ts`.

## Supported Config Versions

Supported config versions are declared in `packages/cli/src/version.ts`.

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

`npm run commit` provides an interactive type selector and builds a valid Conventional Commit message for already staged changes in the Agent Creator repository.

It can also run non-interactively:

```bash
npm run commit -- --type feat --scope cli --message "add command"
npm run commit -- --type refactor --message "change config" --breaking
```

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
- `breaking` -> minor while the current version is `0.x`, major from `1.x`

`npm run build` without `--release` fails. Internal validation may use `npm run build:plain` when it must compile without changing versions.

Both versioned and plain builds minify emitted workspace JavaScript with Terser before package checks or publishing. The minification is a packaging optimization, not a security boundary; generated project templates copied into the CLI package are not minified.

## Release Process

Before a release:

```bash
npm run build -- --release fix
npm test
node packages/cli/dist/src/index.js create demo-agent --force
cd demo-agent
npm run build
npm test
node ../packages/cli/dist/src/index.js validate
```

Release dependency rule:

- Any package statically imported by a workspace package's runtime source must be listed in that package's `dependencies`.
- The CLI and generated pre-1.0 projects pin the exact synchronized `@agent-creator/core` version.
- The test suite includes a runtime dependency guard to catch missing published-package dependencies before npm release.
- `npm pack --dry-run` should show only the publish allowlist, not source tests or stale `dist` artifacts.
- The `prepare` script installs Husky when possible but must not block npm packing/publishing in restricted environments.
- `npm run check:package` enforces the publish allowlist and fails if source, tests, demo projects, traces, or local config files enter the tarball.
- Package metadata includes repository, license, bugs, homepage, and security policy references. npm provenance remains disabled until the CI publication identity is defined.

Publish commands:

```bash
npm run publish
npm run publish:beta
```

Both publish commands run `build:plain`, tests, package content checks, and then `npm publish --access public --tag <tag>`.

Release steps:

1. Run `npm run build -- --release <type>` to bump versions and compile.
2. Ensure workspace, core, CLI, and capability versions remain synchronized.
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
