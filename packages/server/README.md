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
| `serve.ts` | the order: store, then surface, then listener — and the warning for binding off loopback |
| `codec.ts` | the seam where the generic store meets the outline format |
| `runtime.ts` | the two surface bindings: the stream is `SubscriptionRef.changes` verbatim, the errors cell is an owned source |
| `listener.ts` | HTTP for the bundle, WebSocket for the surface: origin gate → upgrade → stale-tab gate → heartbeat → serve |
| `clientDist.ts` | `OLAI_DIST_DIR`, the one place the built bundle is named |
| `main.ts` | argv, defaults, and the top-level run |

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
