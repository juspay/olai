# ACP: chat with an agent inside olai

Status: brainstorming ahead of the Agents theme. Direction set 2026-08-09: the chat panel ships directly as **one PR** — ACP session, send/stream/cancel, agent edits landing live. Exposing ops as MCP tools to *external* coding agents is punted to its own future roadmap item.

## Settled (carried from the ratified rewrite plan)

- SDK: `@agentclientprotocol/sdk` — the official TypeScript SDK; `@zed-industries/agent-client-protocol` is its outdated predecessor. ACP is JSON-RPC over stdio.
- Agents never write files whole: ACP's file-write capability stays deliberately unused. Edits go through the server's ops layer — add, mark, move, archive; fractional-ord insertion; temp-file → re-validate → atomic rename → commit — which is **born in this PR**, since chat's agent is the first writer. It sits on the store's `commit()` write gate (optimistic concurrency, `StaleWrite` retry), also deferred to here.
- Chat rides surface `events`; everything stays server-authoritative — a successful op appears via the live snapshot stream, never an optimistic echo.
- Prior art: kolu's `surface-mcp` package (a surface exposed as MCP tools).
- Note: `session/new` accepts MCP server configs, so the natural channel from agent to ops is an *internal* MCP server the olai server hands to its own session. Punting external MCP does not preclude this internal use — see Open.

## Resolved 2026-08-09

- **Agent**: Claude first, via a claude-code ACP adapter. The protocol stays agnostic; a picker is not this PR.
- **Agent→ops channel**: the internal MCP server, passed via `session/new` — the standard ACP shape, and the external-MCP roadmap item then falls out nearly free.
- **Process model**: the server owns **one singleton ACP session** — olai is a single-user app. No per-tab or per-outline sessions.
- **Permissions**: auto-approve ops tool calls for now (they are already mediated and validated); a permission UI is deferred to a future item.
- **Read access**: query tools on the internal MCP only — no fs access to the served directory. The MCP should probably also expose a grep-like search tool.
- **Transcript persistence**: always persist, as Claude Code's own session for the served directory — so the same conversation can be resumed from a terminal with `claude --resume`. Olai builds no transcript store of its own; the transcript is Claude's session JSONL, exactly as olai on `master-racket` did it.
- **Errors are never silently ignored**: a `StaleWrite` retry that *succeeds* is invisible by design, but every genuine failure — a derived-state refusal, a retry that keeps colliding — renders in chat with its structured detail (e.g. the unfinished children), not prose.

## Open

- Resume-on-restart mechanics: whether the adapter supports ACP `session/load` so the singleton session survives an olai restart, or resuming stays a terminal-side affair (`claude --resume`).
- Shape of the grep/query tools: over parsed nodes (titles, descs, tags) vs raw file lines — parsed keeps the one-validator worldview.
