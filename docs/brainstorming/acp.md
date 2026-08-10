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

## Resolved 2026-08-09, round two — racket semantics adopted

The human likes the `master-racket` chat behaviour; its semantics carry over (see the racket audit for the reference: `docs/cli.md` and `olai/acp.rkt` on that branch):

- **Boot adopts the most-recently-updated session** for the served directory (`session/list` → `session/load`, transcript replayed into the panel); **`+ new`** starts fresh via `session/new`. This settles resume-on-restart: it is the racket mechanism, not a terminal-side affair — though `claude --resume` in a terminal keeps working on the same sessions.
- **Session picker**: list sessions (newest first), switch, new — racket's `chats` popover shape.
- **Streaming frames**: user / chunk / tool (foldable, updatable by id) / done (rendered markdown) / error / model / commands — projected into surface events over the one live connection (racket used SSE; ours is the surface WS).
- **Slash-command completion** in the chat input, fed by the agent's own `commands` list; **model shown** in the panel header; **cancel**.
- **Query tools are over parsed nodes**, not raw lines: search titles/descs/tags, fetch subtrees, list outlines — results carry `file:line`. No raw grep; the agent reasons about nodes, never bytes (the glued-line incident of 2026-08-09 is the argument made flesh: byte-level editing produced a broken file that semantic ops cannot even express).
- **Adapter packaging like racket**: the claude-code ACP adapter pinned via nix (racket's `olai-acp-agent` package is the prior art), env-var override as the escape hatch.
- **Scope: full parity in the one PR** — send/stream/cancel + ops + session adoption/picker/new + folding + slash completion + model display arrive together.
- Racket behaviours deliberately NOT carried: no MCP tools at all (its agent was stock Claude Code with fs access and bypass permissions, editing files whole) — ours edits through mediated ops only; and permissions stay auto-approved as already resolved.

## Resolved 2026-08-10 — the external tool surface (roadmap `mcp`)

The punt above came back, and the prediction held: the internal channel produced
most of it. `@olai/ops`'s `mcp.ts` was written with no transport in it, so what
this item added is a second caller of the same `handle` and the composition
around it — the tools themselves, the dispatch, the refusal shape and the closed
list are untouched.

- **Transport: stdio, as a subcommand — `olai mcp <dir>`.** Nearly every MCP
  client configures a server as a command it launches, so that is what an agent
  in a terminal is given. The alternative was a bridge into a running `olai web`
  (find its port, find its per-process token, POST at `/mcp`), and it loses on
  the ordinary case: somebody in a notes directory with no server running. A
  bridge would have to do all of this anyway on finding nothing listening, and
  would additionally need a discovery mechanism nothing else in olai has.
- **Two stores over one directory is the accepted consequence**, and it is the
  same bargain the write gate was built for: it probes before it judges, so a
  base another process moved comes back as `StaleWrite` and the op re-plans
  against the newer snapshot — exactly what a `git pull` under an open tab
  already does. It is not a lock: two writers inside the same instant are
  last-write-wins, as an editor and a `git checkout` are, and git is the
  recovery net. Note this is the OPPOSITE conclusion from the internal agent's
  HTTP route, out of the same question — the panel's agent is a child of the
  server and shares its store by construction; this one cannot.
- **stdout is the protocol**, so the whole program's logging goes to stderr via
  `Logger.LogToStderr` rather than by asking each writer to remember. The store
  logs failed probes and git logs refused commits, and neither knows it is
  running under a pipe a JSON-RPC parser is reading.
- **No token, no bind, no origin gate.** There is nothing to authenticate: the
  client proved who it is by being the process that started this one. That is
  also why `mcp` takes no `--port` and no `--host`.
- **The client closing stdin is the shutdown**, which is how an MCP client stops
  a server; a write that fails because the far end is gone ends the same way,
  quietly, rather than dying into whatever log the client keeps.
- **Still no write CLI.** `web` and `mcp` are two transports in front of one ops
  layer, and neither adds a node from the command line.

## Open

Nothing. Dispatch-ready.
