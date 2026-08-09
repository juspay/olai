# Architecture

Olai serves one directory, recursively monitored. `.jsonl` files are outlines ([format.md](format.md)); `.md` files are documents. There is no CLI: the two write surfaces are the web UI and agent MCP tools, both calling one ops layer.

## Shape

```
files on disk ── load + validate ──▶ snapshot ── surface stream ──▶ browser (SolidJS)
      ▲                                              │
      └───── ops (add, mark, move, archive) ◀── procedures / MCP tools / chat (ACP)
```

- **Store** (`packages/store`, generic — caller-supplied codec, no olai types; extractable to its own repo later): files load into a validated snapshot. Staleness is detected by a probe (file stamps plus re-asked directory listings); a file watcher only triggers the probe, so a file arriving via `git pull` appears without a restart. A broken file keeps the last good snapshot and raises the error state. Design: [brainstorming/architecture.live-store.md](brainstorming/architecture.live-store.md).
- **Surface mapping** (kolu's surface framework, pinned via npins): the snapshot is a `stream` (the store's own `SubscriptionRef.changes` — current value then updates, which already IS snapshot-then-deltas; poll-on-event would put staleness suppression in the surface layer, duplicating the probe the store owns); ops are `procedures`; error state is a `cell`; collapse/view toggles are local `cells`; chat rides `events`. Every subscription sends a full snapshot first, then deltas; a reconnect is just a fresh snapshot — no resume protocol, no optimistic UI. No raw wire code — Effect RPC, sockets, HTTP routes — exists outside surface's API.
- **Web**: a SolidJS client over WebSocket, using surface's solid hooks (subscriptions reconcile into Solid stores). The client bundle is built by `Bun.build` via `@kolu/surface-app`'s helpers; the server is a Node `http` server with a `ws` upgrade. Started as `olai web <dir> [--port] [--host]` — a nix-built binary whose only job is serving; `just serve` and `nix run` wrap it — bound to loopback by default. The UI is a sidebar listing the found outlines with one tree in the main pane, a route per outline; mirrors render their target's subtree inline, marked.
- **Agents**: chat is an ACP session (`@agentclientprotocol/sdk`); the session is handed an MCP server exposing the ops as tools. Whole-file agent writes are rejected by design — agents edit through the same ops layer as everyone else.
- **Git is the only history**: no sync protocol, no CRDT. Writes commit via shelling out to `git`.

## Stack

TypeScript on Bun (test runner and scripts; types via `tsc --noEmit`). Effect throughout — kolu's whole stack is Effect 4 (kolu PR #2101; the "Effect, everywhere" post): Effect Schema at process boundaries, `RpcGroup` on the wire, `HttpRouter` layers for HTTP, `Schedule` for reconnect — zod, oRPC, partysocket and hono are gone. The `effect` version matches the pinned kolu's exactly (one copy fleet-wide, enforced via `package.json` overrides). Effect-on-Bun is the proven odu/drishti pattern: `@effect/platform-node` under Bun's Node compatibility, with one known seam — Bun's unix-socket async-connect-error contract needs odu's one-line shim, relevant only if we ever serve a unix socket. remark + rehype-sanitize for markdown; Temporal for dates. Nix flake + npins (kolu, nixpkgs) + justfile; `@kolu/*` packages hydrate as source from the Nix store. Cucumber + Playwright for e2e.

Kolu's Effect-4-beta discipline ports over with the stack: any dependence on beta *behavior* carries a grep-able `BETA-ASSUMPTION(<version>)` marker that fails CI on a pin bump until re-measured, and CI scanners ban the silent agent failure modes — `await` on an Effect, an Effect built but never run — with every `Effect.run*` edge on a named allowlist.

## Packages

A Bun workspace (`packages/*`, shared `tsconfig.base.json`). Layering between packages is declared in workspace dependencies and machine-checked; the dependency direction is UI → server → ops → format core, never sideways or up. The format validator lives in exactly one place — never re-checked in the reader, the store, or the web layer.

| package | depends on | what it is |
|---|---|---|
| `format` | — | the format core: `parseOutline` per file, `validate` per set, and the derivations (status, sibling order, tags) both the validator and the view read from |
| `store` | — | files as a revision-tagged snapshot; generic over content, so it carries no outline types |
| `surface` | `format` | the surface spec: an `outlines` stream and an `errors` cell |
| `server` | `format`, `store`, `surface` | the composition root: the codec that joins format to store, the HTTP + WebSocket server, and the `olai web` binary |
| `web` | `format`, `surface` | the SolidJS client and its `Bun.build` bundle |
| `tests` | — | Cucumber features driven through Playwright against the nix-built binary |

`server` does not depend on `web`: it serves a built bundle it is handed (`OLAI_DIST_DIR`, the one place either of them names it), so the browser build is a build artifact rather than an import.

**Owed upstream.** `packages/server/src/listener.ts` sequences an origin gate, an upgrade, a stale-tab check, heartbeat enrolment and a serving stack — the same sequence, in the same order, as kolu's own surface-app example. That is a `serveSurfaceApp({surface, handlers, clientDist, host, port, allowedOrigins})` primitive belonging in `@kolu/surface-app`, beside the `surfaceAppLayer` and `acceptSurfaceSocket` it already owns. Until it exists, two copies are kept in step by hand, which is exactly the volatility a receptacle is supposed to contain.

## Errors

Error kinds (`usage`, `validation`, `not-found`, `derived`, `busy`) are `Schema.TaggedErrorClass`es — schemas that travel the wire and decode as themselves — surfaced as MCP tool errors and HTTP codes. Every validation error names `file:line`. Errors that teach are the product: a refused derived-state write lists the unfinished children as structured data.

Validation is staged, and the stage is part of the taxonomy (`stageOf`): a file is decoded whole or not at all, and the set-wide rules do not run until every file parses. "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is the one that failed to parse, so a report containing a per-line error says out loud that the set-wide questions have not been asked yet.
