# Trace And Debugging

Core uses `NoopTraceProvider` by default. Applications can register a custom provider with `builder.useTrace(provider)`.

A Trace provider receives the Agent input and generated trace ID, then returns a run object with:

- `append(event)`
- `end(output)`

Providers may write JSON files, send telemetry to an external service, or keep traces in memory.

The CLI keeps `agent trace` as a compatibility reader for providers that write `.agent-traces/<traceId>.json`:

```bash
agent trace --list
agent trace --latest
agent trace --id trace_xxx
```

The core package does not access the filesystem or select a tracing backend.

## Web Dev Console Direction

The first Web Dev Console should be a debugging view, not a full management UI. It should help developers answer what happened during one Agent run:

- Agent input, session ID, user ID, and trace ID.
- Guard result, including the blocking reason when a request is denied.
- Planner output and ordered plan steps.
- Skill and workflow calls, including names, inputs, outputs, status, and duration when the Trace provider records timing.
- Runtime errors and model/provider errors with repair-oriented messages.

The console should consume Trace provider data from generated projects or service routes. It should not require changes to the core runtime data flow unless the current trace events cannot represent a specific debugging need.
