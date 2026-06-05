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
