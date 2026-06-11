# Skill Authoring Guide

Generated Agents are docs-first, thin consumers of `@agent-creator/core`. Keep vertical-domain behavior in Skills, Guards, and module packages rather than changing the core runtime.

## Skill Boundaries

- Use one Skill for one domain action or decision.
- Put orchestration across multiple steps in a workflow Skill.
- Put safety, permission, compliance, and domain-boundary checks in Guards.
- Keep `inputSchema` and `outputSchema` stable; callers and workflows depend on them.

## Naming

- Prefer action-oriented names such as `customer.search`, `invoice.validate`, or `claim.triage`.
- Use `agent add skill customer-search` to scaffold `customer.search`.
- Use `agent add workflow customer-onboarding` when the Skill coordinates multiple steps.

## Permissions

- `public`: safe local computation or read-only behavior.
- `external_api`: calls outside services or webhooks.
- `user_private`: touches user-private data or sensitive business records.

## Tests

Each domain Skill should have focused tests for:

- Valid input and expected output shape.
- Invalid input rejected by zod.
- External API or dependency failures.
- Permission or domain-boundary cases enforced by Guards.

## Vertical-Domain Example

For a customer support Agent, keep each concern narrow:

- `customer.search` Skill: accepts a customer email or account ID, calls the customer system, and returns a stable customer summary. Mark it `user_private` if it reads private account data.
- `support-policy` Guard: blocks requests that ask for credentials, bulk exports, account deletion, or data outside the current user's allowed scope.
- `customer-onboarding` workflow Skill: coordinates the multi-step onboarding path, for example checking the customer record, validating missing information, creating a follow-up task, and returning a summary with completed and failed steps.

The workflow should not hide broad business policy. Put policy and permission checks in Guards, put reusable domain actions in Skills, and let the workflow call only the steps needed for one user-visible outcome.
