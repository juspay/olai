# @olai/server — the composition root, and the binary

One directory, read and served — and, since the agent arrived, written. Plus
the two entry points that start it: `olai web <dir> [--port] [--host]
[--no-commit]`, which puts a browser in front of the ops layer, and `olai mcp
<dir> [--no-commit]`, which puts an agent's pipes in front of the same one.

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

Talking to the agent is not here. It was, and it was four modules of domain
inside a file whose whole job is the ORDER things go in — so it left, as
`@olai/chat`. What is left of it here is a workspace dependency and one call:
resolve the adapter from the environment, build, wire the two publishers, and
register `stop` as a finalizer.

## The files, and their separate reasons to change

| file | what it owns |
|---|---|
| `serve.ts` | the order above — the warning for binding off loopback, and which runtime failures are news |
| `mcp/route.ts` | the tool surface for the agent olai STARTED: mounted on this listener, behind a per-process bearer token |
| `mcp/serve.ts` | the tool surface for an agent that started US: `olai mcp`'s own, much smaller, composition root |
| `mcp/stdio.ts` | that one's transport — newline-framed JSON-RPC over a pair of pipes, and nothing else on stdout |
| `runtime.ts` | the surface bindings: the outline stream is `SubscriptionRef.changes` verbatim, the errors cell is an owned source, the transcript is server-authored |
| `listener.ts` | HTTP for the bundle, WebSocket for the surface: origin gate → upgrade → stale-tab gate → heartbeat → serve |
| `media.ts` | `/media/*`: the pictures a document points at, and the only bytes that leave the served directory over HTTP without going through the store |
| `manifest.ts` | what an installed olai is: name, description, colours, and the mark |
| `clientDist.ts` | `OLAI_DIST_DIR`, the one place the built bundle is named |
| `main.ts` | argv, defaults, and the top-level run |

The stale-tab gate in that sequence is not a formality: a browser reconnecting
after a restart presents the process id it was given by the server that is
gone, and this one closes the socket at the handshake rather than serving a
page it did not build. No id is threaded through this package to make that
work — the gate compares against the framework's own `surfaceProcessId()`, the
same value `system/identity` answers with and the browser echoes back, so the
two ends cannot be pointed at different ids.

## The frame cap is the framework's number

The websocket's `maxPayload` is `RPC_MAX_FRAME_BYTES` (plus the newline an
ndjson frame ends with, which is on the wire but outside what the decoder
measures). Not a setting of ours: `@kolu/surface` owns the wire's frame size
and owns what happens to a frame that busts it — its decoder classifies the
frame and closes with a documented code the client is written to recover from.
A smaller cap here does not make the wire safer, it just moves the refusal to a
layer with no classifier and no client that understands it, killing every
subscription multiplexed onto that socket. This file said `8 MiB` against the
framework's 16, so every frame in between — a big outline snapshot — died at
the wrong layer; sourcing the number is what stops the two from disagreeing
again, and `listener.test.ts` fails if they do. (Under bun the option is a
declaration: bun's built-in `ws` ignores `maxPayload` and enforces 16 MiB of
its own. A node host obeys it.)

## The manifest is served, the icons are not

`src/manifest.ts` is what an installed olai is — the name, the description, the
colours and the icon list — served at `/manifest.webmanifest` through
`@kolu/surface-app`'s manifest layer, which owns the install-friendly defaults
(`start_url`, `display: standalone`) so they are not restated. Its own file
rather than a block in `listener.ts`: the app's identity has nothing to do with
sequencing an upgrade, and that file is one this repo means to give back
upstream. The icon *files* belong to the browser bundle and are served
as part of it, which means the two ends of that contract live in two packages
that do not import each other. Nothing here can check that a `src` it names is
a file that exists — and the static layer answers an unmatched path with the
HTML shell, so a stale one would return 200 rather than 404. What checks it is
a browser test that follows every `src` and asserts on the content type
(`packages/tests/features/install_it.feature`).

The server does not build the client and does not import it. It serves a bundle
it is handed, so `@olai/web` is deliberately absent from its dependencies and
the browser build stays a build artifact rather than an import. A fallback that
walked from `clientDist.ts` into `packages/web/dist` would be a real
`server → web` dependency expressed as a path — invisible to `bun install` and
to any layering check.

`media.ts` is two decisions and no mechanism of its own. WHETHER to answer is
`@olai/surface`'s `mediaTarget` — the traversal guard and the picture
allowlist, which live there because the client's renderer writes those URLs
against the same function. HOW to answer is the platform's own file engine
(`HttpStaticServer`), the same one already serving the bundle from the layer
beside it: reading a file under a root is not a thing to hand-roll twice in one
process, and the engine brings the stat, the directory case, the MIME type, the
byte range and the conditional `304` a browser asks for on its second look at a
picture. What is left in this file is the wiring and one 404 for every way a
picture is not there — which way it is missing is not the reader's business,
and saying would describe the disk to anybody who can reach the port. The guard
is lexical by design: it stops a URL from naming a file outside the directory,
and does not chase a symlink someone put inside a tree they are already serving
whole.

## Entry point

`main`, `types` and `exports` point at `src/serve.ts`, **not** `src/main.ts`.
`main.ts` ends in a top-level run that starts the server and installs signal
handlers, so a resolver honouring `main` over `exports` would boot a listener
on import. The binary is reached as a script path — by `default.nix` and by the
justfile — never as a module.

Everything `serve` opens is a finalizer of the enclosing scope, so shutting
down is closing the scope; no caller holds a teardown function it might forget
to call.

## The tools, without a browser

`olai mcp <dir>` is the other subcommand, and it is the same ops layer with a
different thing in front of it. Its client is a coding agent in a terminal, so
it gets what nearly every MCP client expects — a command it launches, and
JSON-RPC over the pipes:

```sh
claude mcp add olai -- olai mcp ~/outlines
```

Three things about it are decisions rather than defaults, and `src/mcp/serve.ts`
argues each where it happens:

- **Its own store**, rather than a bridge into a running `olai web`. This has to
  work with no server running, which is the ordinary case; a bridge would need
  that server's port and its per-process token discovered from outside, and
  would still have to do all of this on finding nothing listening. Two stores
  over one directory is safe for the reason the write gate exists — it probes
  before it judges, so an out-of-band change is part of the revision a write is
  checked against — and it is not a lock, which is the same trade an editor and
  a `git pull` already make.
- **stdout is the protocol**, so the whole program's logging goes to stderr
  (`Logger.LogToStderr`). A failed probe from the store on stdout is a frame
  that is not a frame, and nothing downstream should have to know that.
- **No port, no host, no token.** There is nothing to authenticate: the client
  proved who it is by being the process that started this one. It stops when
  that client closes stdin.

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
just run mcp docs            # the tool surface over stdio, from the working tree
```

The first is the edit loop: two `bun --watch` processes, so a validator rule you
change is live on the next reload. `just nix` is the other path — the packaged
binary, built from tracked files only, which is what CI and `just e2e` prove.

The second takes JSON-RPC on stdin, one message per line, which makes it
pipeable — the fastest way to see what an agent is actually offered:

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | just run mcp docs | tail -1
```

(`tail -1` is for the recipe, not the server: `just run` prints its own install
line first. The binary itself writes nothing to stdout but frames.)

## The agent

**The default is Claude Code, on every documented launch path.** The adapter is
pinned (`nix/acp-agent.nix`) and the packaged binary's wrapper bakes it in with
`--set-default`, exactly as the racket reference's `default.nix` did; `just
serve` and `just run` resolve the same derivation on demand through
`scripts/acp-agent.sh`. Nobody following a documented path has to know the
variable exists — and the `nix` CI lane asserts it rather than trusting this
paragraph: the wrapper must carry the assignment and the path it names must be
executable.

`OLAI_ACP_AGENT` overrides that, and it has two useful shapes:

| value | meaning |
|---|---|
| a command | that is the agent — how the e2e suite points at a scripted one |
| the empty string | deliberately no agent |
| unset | the pinned default, wherever one was baked in |

The empty case works through the packaged binary because `makeWrapper
--set-default` emits `${VAR-default}` — one dash, so it substitutes only when
the variable is UNSET. The CI lane asserts that spelling too: `:-` would swallow
the off switch.

**With no agent, olai serves the outlines exactly as it does with one** —
reading a directory has never depended on one, which is why this does not
refuse to start the way the racket reference did. But the panel is NOT hidden:
the `chat` cell reads `off` and the drawer says there is no agent and which
variable would give it one. A capability that is silently absent cannot be told
apart from one that is broken.

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
