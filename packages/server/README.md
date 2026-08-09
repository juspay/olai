# @olai/server — the composition root, and the binary

One directory, read and served. A store over the directory, the surface bound
to it, a listener in front — plus the `olai web <dir> [--port] [--host]` entry
point that starts the three in that order.

This is the only package allowed to know about all the others, which is what a
composition root is for. It is also the only place `@olai/format` and
`@olai/store` meet: `src/codec.ts` is four bindings with no branch of its own,
because every decision it would otherwise make — which files belong to the set,
how decoded files become one set, how failures join — is a statement about the
format and lives in `@olai/format`. If a rule ever appears in that file, the
one-validator rule has been broken.

## The files, and their separate reasons to change

| file | what it owns |
|---|---|
| `serve.ts` | the order: store, then surface, then listener — the warning for binding off loopback, and which runtime failures are news |
| `codec.ts` | the seam where the generic store meets the outline format |
| `runtime.ts` | the surface bindings: the stream is `SubscriptionRef.changes` verbatim, the errors cell is an owned source, and `identity.info` answers with this process's id |
| `identity.ts` | that id, minted once — the runtime answers with it and the listener's stale-tab gate compares against it |
| `listener.ts` | HTTP for the bundle, WebSocket for the surface: origin gate → upgrade → stale-tab gate → heartbeat → serve |
| `clientDist.ts` | `OLAI_DIST_DIR`, the one place the built bundle is named |
| `main.ts` | argv, defaults, and the top-level run |

The stale-tab gate in that sequence is not a formality: a browser reconnecting
after a restart presents the process id it was given by the server that is
gone, and this one closes the socket at the handshake rather than serving a
page it did not build. The gate only fires because the browser has an id to
present — the `identity.info` half — so the two live and die together.

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

Depends on `format`, `store` and `surface`, strictly downward. Nothing depends
on this. [docs/architecture.md](../../docs/architecture.md) has the reasoning —
including the note that `listener.ts` is a sequence owed upstream to
`@kolu/surface-app`.

## Running

```sh
just serve docs              # build the client, serve this repo's own roadmap
```

That is the edit loop: two `bun --watch` processes, so a validator rule you
change is live on the next reload. `just nix` is the other path — the packaged
binary, built from tracked files only, which is what CI and `just e2e` prove.
