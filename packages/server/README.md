# @olai/server — the composition root, and the binary

One directory, read and served — and, since the agent arrived, written. Plus
the `olai web <dir> [--port] [--host] [--no-commit]` entry point that starts
it all in order.

This is the only package allowed to know about all the others, which is what a
composition root is for. The ORDER is the whole of what it decides: a store
over the directory, the ops layer over the store, an internal MCP server over
the ops, an ACP agent handed that server, the surface bound to both, a listener
in front. Each of those lives in its own file with its own reason to change.

One ordering is not arbitrary and is written down where it happens: the chat is
built BEFORE the surface, because the surface's transcript collection is seeded
from it, and the surface is what the chat publishes through — so its publishers
are handed back and installed once it exists. Nothing publishes in between,
because the agent is not started until the listener is up (it has to be told
the address of the MCP route, which is only knowable once we know what we
bound).

## The files, and their separate reasons to change

| file | what it owns |
|---|---|
| `serve.ts` | the order above — the warning for binding off loopback, and which runtime failures are news |
| `chat/agent.ts` | the ACP client: one subprocess, one protocol. Nothing else in olai spells `session/prompt` |
| `chat/events.ts` | the closed vocabulary of what an agent tells us — a consumer that needs more needs a new member, not a look at the wire |
| `chat/transcript.ts` | the conversation as ROWS: chunks accumulate, tool calls update in place by id, a replay replaces rather than appends |
| `chat/chat.ts` | the join, and the only place that knows both halves |
| `chat/adapter.ts` | which executable speaks ACP, and that an unset `OLAI_ACP_AGENT` means no panel rather than no server |
| `mcp/route.ts` | the internal MCP server, mounted on this listener, behind a per-process bearer token |
| `runtime.ts` | the surface bindings: the outline stream is `SubscriptionRef.changes` verbatim, the errors cell is an owned source, the transcript is server-authored |
| `listener.ts` | HTTP for the bundle, WebSocket for the surface: origin gate → upgrade → stale-tab gate → heartbeat → serve |
| `clientDist.ts` | `OLAI_DIST_DIR`, the one place the built bundle is named |
| `main.ts` | argv, defaults, and the top-level run |

The stale-tab gate in that sequence is not a formality: a browser reconnecting
after a restart presents the process id it was given by the server that is
gone, and this one closes the socket at the handshake rather than serving a
page it did not build. No id is threaded through this package to make that
work — the gate compares against the framework's own `surfaceProcessId()`, the
same value `system/identity` answers with and the browser echoes back, so the
two ends cannot be pointed at different ids.

The server does not build the client and does not import it. It serves a bundle
it is handed, so `@olai/web` is deliberately absent from its dependencies and
the browser build stays a build artifact rather than an import. A fallback that
walked from `clientDist.ts` into `packages/web/dist` would be a real
`server → web` dependency expressed as a path — invisible to `bun install` and
to any layering check.

## Entry point

`main`, `types` and `exports` point at `src/serve.ts`, **not** `src/main.ts`.
`main.ts` ends in a top-level run that starts the server and installs signal
handlers, so a resolver honouring `main` over `exports` would boot a listener
on import. The binary is reached as a script path — by `default.nix` and by the
justfile — never as a module.

Everything `serve` opens is a finalizer of the enclosing scope, so shutting
down is closing the scope; no caller holds a teardown function it might forget
to call.

## Starting up, and what you are told when it will not

**A busy port is not a refusal.** If the port asked for is already listening,
the listener binds once more on a port the OS picks and says so:

```
port 7714 in use — serving on http://127.0.0.1:40429 instead
serving /home/you/outlines on http://127.0.0.1:40429
```

The reader asked to read their outlines, not to own port 7714. Every other
listen failure still is a refusal — a host that is not this machine's, a
privileged port — which is why exactly one error code recovers rather than
"listen failed". The address that gets reported is always the one **actually
bound**: the browser tests read the URL out of that line rather than assuming
the port they passed, because the printed address is the only thing that knows.

**A failure is reported as itself.** The surface runtime's `done` settles for
two very different reasons — it faulted, or it is being closed — and only the
first is news. Treating the second as a fault is how a busy port used to print
`surface runtime faulted — unrecoverable: [object Object]` and exit before the
real `cannot listen on 127.0.0.1:7714: …` could be reported at all: the
teardown that a failed `listen` starts closes the runtime, and closing it
settled `done`. So the fault handler only speaks while we are still meant to be
serving, and it renders an Effect `Cause` with `Cause.pretty` rather than
`String`, which on a `Cause` is `[object Object]`. `src/serve.test.ts` holds
both halves against a real socket.

## Layering

Depends on `format`, `ops`, `store` and `surface`, strictly downward. Nothing
depends on this. [docs/architecture.md](../../docs/architecture.md) has the reasoning —
including the note that `listener.ts` is a sequence owed upstream to
`@kolu/surface-app`.

## Running

```sh
just serve docs              # build the client, serve this repo's own roadmap
```

That is the edit loop: two `bun --watch` processes, so a validator rule you
change is live on the next reload. `just nix` is the other path — the packaged
binary, built from tracked files only, which is what CI and `just e2e` prove.

## The agent

`OLAI_ACP_AGENT` names an executable that speaks the Agent Client Protocol on
stdio. The nix-built binary bakes the pinned adapter in (`nix/acp-agent.nix`,
via `--set-default`), so a packaged olai needs nothing ambient; exporting the
variable yourself wins, which is how the e2e suite points at a scripted agent
and how you point at a different one.

**Unset, olai serves without a chat panel** rather than refusing to start. That
is the one place this differs from the racket reference, which made the variable
a usage error, and the reason is that olai's product is the outline: reading it
must not depend on an agent being installed. The `chat` cell reads `off` and
the panel draws nothing.

Boot is EAGER and runs on its own fiber, so pages serve while the handshake
happens and a boot that fails changes nothing — the next prompt retries it
exactly as a crash does. What it does, in an order that is a protocol fact
rather than a preference: `initialize` (which is what says whether this agent
keeps conversations at all), then `session/list` for the served directory, then
`session/load` of the most recently updated one — or `session/new` when there
is nothing stored. The list is narrowed to the exact directory here, once:
the Claude Code adapter scopes its answer by PREFIX, so a server started in a
checkout is told about every agent working under it, and adopting the newest of
that would make an orchestrator's coding session this panel's conversation.

The MCP server the session is handed is this process's own, on this process's
listener, behind a bearer token minted per process. `mcp/route.ts` says why
HTTP rather than stdio: the tools are this process's ops over this process's
store, and a stdio server would be a second olai with a second store watching
the same directory.
