# Trace And Debugging

Core uses `NoopTraceProvider` by default. Applications can register `FileTraceProvider`, `InMemoryTraceProvider`, or a custom provider with `builder.useTrace(provider)`.

A Trace provider receives the Agent input and generated trace ID, then returns a run object with:

- `append(event)`
- `end(output)`

Standard Trace documents use `formatVersion: "0.1"` and contain:

- request ID and trace ID
- input shape summary without raw prompt text
- Guard, Planner, model, authorization, and Skill attempt events with durations
- model token usage when the provider returns it
- structured error codes and final output summary

Sensitive keys are recursively redacted. API keys, authorization headers, raw prompt/content, metadata, and Skill input/output are not automatically persisted.

`FileTraceProvider` writes `.agent-traces/<traceId>.json` with restrictive file permissions. Generated projects enable it in development so `agent trace` works immediately:

```bash
agent trace --list
agent trace --latest
agent trace --id trace_xxx
```

Production applications should register a custom provider for OpenTelemetry, a database, or their logging platform. The stable `requestId` should be indexed alongside `traceId`.

## Web Dev Console Direction

The first Web Dev Console should be a debugging view, not a full management UI. It should help developers answer what happened during one Agent run:

- Redacted input summary, request ID, and trace ID.
- Guard result, including the blocking reason when a request is denied.
- Planner output and ordered plan steps.
- Skill and workflow calls, including names, attempts, authorization, status, and duration.
- Runtime errors and model/provider errors with repair-oriented messages.

The console should consume Trace provider data from generated projects or service routes. It should not require changes to the core runtime data flow unless the current trace events cannot represent a specific debugging need.
