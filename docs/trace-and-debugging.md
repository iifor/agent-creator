# Trace and Debugging

Generated projects write trace JSON files to `.agent-traces/<traceId>.json` when trace is enabled.

## Trace Contains

- `traceId`
- `requestId`
- `startedAt`
- `endedAt`
- `latencyMs`
- `userInput`
- `detectedIntent`
- `plan`
- `toolCalls`
- `toolResults`
- `finalOutput`
- `errors`

## Commands

```bash
agent trace --list
agent trace --latest
agent trace --id trace_xxx
```

## Debugging Flow

1. Use `traceId` from `AgentOutput`.
2. Run `agent trace --id <traceId>`.
3. Check detected intent.
4. Check plan steps.
5. Check tool calls and results.
6. Check final output and errors.

Trace JSON files are ignored by git through `.agent-traces/*.json`.
