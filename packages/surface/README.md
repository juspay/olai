# @olai/surface — the typed reactive layer, declared once

The spec both ends speak. The server implements it and the browser subscribes
to it, and neither writes a line of wire code: no raw sockets, no hand-rolled
routes, no message envelopes. Because the two sides read the same declaration,
they are a type error away from disagreeing about the protocol rather than a
runtime surprise.

Built on kolu's surface framework (`@kolu/surface`, hydrated from the Nix store
rather than installed — which is why it is absent from this manifest and
declared once at the workspace root; see `bunfig.toml`).

## Two members, and the shapes are the argument

Phase 2 declares exactly two things, and which kind each one is was a decision:

- **`outlines` is a stream, not a cell.** The files belong to the disk, not to
  the server, so the server reports what it read rather than owning a value it
  could be asked to change. Every subscription opens with a full snapshot, so a
  reconnect is a fresh read and nothing has to be resumed.
- **`errors` is a cell**, read-only on the wire, because "what is wrong right
  now" is one value the server does own. It is deliberately independent of the
  snapshot: phase 3 keeps the last good tree on screen underneath it, and a
  consumer written against two subscriptions today needs no change to get that.

`OutlineFrame` is nullable on purpose. A reader must tell three states apart —
no answer yet (no frame), the files are broken (`null`), here is your outline
(a snapshot) — and a nullable frame says all three with no second encoding. Why
it is broken lives in the `errors` cell and nowhere else; carrying the list
here too would let a consumer pick which of two truths to show.

Ops arrive as procedures in phase 4 and chat as events in phase 5, into this
same spec.

## Entry point

`main`, `types` and `exports` all point at `src/index.ts`, which exports the
`surface` definition and the `OutlineFrame` schema. That is the whole package —
a declaration, with no implementation on either side of it.

## Layering

Depends on `@olai/format` and nothing else in the workspace: the only olai
types on the wire are the format's own, travelling verbatim. `server` and `web`
both depend on this. [docs/architecture.md](../../docs/architecture.md) has the
reasoning.

## Running

```sh
just test                    # the whole workspace's unit tests
```

`src/surface.test.ts` is two tests, and it earns more than it looks. It asserts
that `errors` serves no `set` verb — the browser may not write it — and that
the assembled RPC group contains the framework's own members alongside ours,
which only holds if the `@kolu/surface` sources hydrated from the Nix store
resolved `effect` out of the root `node_modules`. A second copy of effect, a
missing root dependency or a stale kolu pin all land here rather than in the
browser.
