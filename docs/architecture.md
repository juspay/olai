# Architecture

Olai serves one directory. `.jsonl` files under it are outlines ([format.md](format.md)); `.md` files are documents. `olai web <dir>` is the only entrypoint, and it only reads — there is no write CLI, and there never will be: the two write surfaces are the web UI and agent MCP tools, both calling one ops layer.

It reads that directory and keeps reading it: edit a file or `git pull`, and the open page follows without a reload. Writing arrives with the ops layer; the paragraphs below say which parts are built and which are the shape they are being built into.

## Shape

```
files on disk ── load + validate ──▶ snapshot ── surface stream ──▶ browser (SolidJS)
      ▲                                              │
      └───── ops (add, mark, move, archive) ◀── procedures / MCP tools / chat (ACP)
```

- **Store** (`packages/store`, generic — caller-supplied codec, no olai types; extractable to its own repo later): files load into a validated snapshot, revision-tagged, with errors on a second independent channel so a broken set does not blank what is on screen. It stays current by PROBE — re-list the tree, re-stat everything, diff against a table of mtime+size stamps — with a file watcher that only *triggers* the probe and whose event payloads are dropped unread, plus a settle delay that turns a `git pull` into one probe and a slow backstop for the events a watcher loses. So a file arriving via `git pull` appears without a restart, and only the files whose stamps moved are re-parsed. The walk prunes dot-directories and `node_modules`: a served directory is somebody's working tree, and `.git` is both the largest thing under it and the one git writes to constantly — an unpruned probe would do its most expensive work exactly when git is busy. Writes arrive with the ops layer: `commit({baseRev, changes})` behind the same gate. Design and the decisions behind it: [brainstorming/architecture.live-store.md](brainstorming/architecture.live-store.md).
- **Error scope is hybrid**, and the two halves answer different questions. A file that does not PARSE costs that one outline: the sidebar still lists it, opening it shows its own errors where its tree would have been, and every other outline stays live. A failure that no single file owns — a dangling cross-file reference, a duplicate id, a cycle — holds the whole last-good snapshot and raises a banner over it, because half a set is a set that was never on disk. The codec decides which of the two applies (`validate` is handed each file's `Result`, decode failures included) and the store only publishes the answer.
- **Surface mapping** (kolu's surface framework, pinned via npins): the snapshot is a `stream` (the store's own `SubscriptionRef.changes` — current value then updates, which already IS snapshot-then-deltas; poll-on-event would put staleness suppression in the surface layer, duplicating the probe the store owns); ops are `procedures`; error state is a `cell`; collapse/view toggles are local `cells`; chat rides `events`. Every subscription sends a full snapshot first, then deltas; a reconnect is just a fresh snapshot — no resume protocol, no optimistic UI. No raw wire code — Effect RPC, sockets, HTTP routes — exists outside surface's API.
- **Web**: a SolidJS client over WebSocket, using surface's solid hooks (subscriptions reconcile into Solid stores). The client bundle is built by `Bun.build` via `@kolu/surface-app`'s helpers; the server is a Node `http` server with a `ws` upgrade. Started as `olai web <dir> [--port] [--host]` — a nix-built binary whose only job is serving; `just serve` and `nix run` wrap it — bound to loopback by default. The UI is a sidebar listing the found outlines with one tree in the main pane, a route per outline; mirrors render their target's subtree inline, marked.
- **Agents**: chat is an ACP session (`@agentclientprotocol/sdk`); the session is handed an MCP server exposing the ops as tools. Whole-file agent writes are rejected by design — agents edit through the same ops layer as everyone else.
- **Git is the only history**: no sync protocol, no CRDT. Writes commit via shelling out to `git`.

## Stack

- **Runtime**: TypeScript on Bun — Bun is the package manager, test runner and script runner; types are checked separately with `tsc --noEmit`.
- **Effect**: kolu's whole stack is Effect 4 (kolu PR #2101; the "Effect, everywhere" post) — Effect Schema at process boundaries, `RpcGroup` on the wire, `HttpRouter` layers for HTTP, `Schedule` for reconnect. zod, oRPC, partysocket and hono are gone. The `effect` version matches the pinned kolu's exactly (one copy fleet-wide, enforced via `package.json` overrides).
- **Effect on Bun**: the proven odu/drishti pattern — `@effect/platform-node` under Bun's Node compatibility. One known seam: Bun's unix-socket async-connect-error contract needs odu's one-line shim, relevant only if we ever serve a unix socket.
- **Markdown**: remark + rehype-sanitize, rendered only at view time.
- **Styling**: Tailwind v4 — utilities inline in the components, and a CSS entry holding only the `@theme` tokens and the rules for markup this codebase does not author (a rendered note's tags come from a file on disk and can carry no classes). No `@apply`, which would recreate the problem utilities solve by inventing a second name for a set of them. Deliberately no class-validity scanner: kolu ships unguarded Tailwind and the silent-typo trade-off is accepted (decided 2026-08-09).
- **Dates**: validated as text, not through a date library — a writer must reproduce what it read verbatim. Temporal is the intended tool if arithmetic on them is ever needed; nothing needs it yet.
- **Nix**: flake + npins (kolu, nixpkgs) + justfile; `@kolu/*` packages hydrate as source from the Nix store.
- **E2E**: Cucumber + Playwright.

Kolu's Effect-4-beta discipline ports over with the stack: any dependence on beta *behavior* carries a grep-able `BETA-ASSUMPTION(<version>)` marker that fails CI on a pin bump until re-measured, and CI scanners ban the silent agent failure modes — `await` on an Effect, an Effect built but never run — with every `Effect.run*` edge on a named allowlist.

## Packages

A Bun workspace (`packages/*`, shared `tsconfig.base.json`). Layering between packages is declared in workspace dependencies and machine-checked by `bun install`; the table below is the whole of it. The direction is downward — `server` and `web` sit on top, `format` and `store` at the bottom, and nothing points sideways or up. (`web` does not depend on `server`: they share a wire contract, `surface`, not an import.) The ops layer, when it arrives, goes between `server` and `format`. The format validator lives in exactly one place — never re-checked in the reader, the store, or the web layer.

| package | depends on | what it is |
|---|---|---|
| `format` | — | the format core: `parseOutline` per file, `validate` per set, and the derivations (status, sibling order, tags) both the validator and the view read from |
| `store` | — | files as a revision-tagged snapshot; generic over content, so it carries no outline types |
| `surface` | `format` | the surface spec: an `outlines` stream and an `errors` cell |
| `server` | `format`, `store`, `surface` | the composition root: the codec that joins format to store, the HTTP + WebSocket server, and the `olai web` binary |
| `web` | `format`, `surface` | the SolidJS client, its Tailwind stylesheet, and the `Bun.build` that produces both |
| `tests` | — | Cucumber features driven through Playwright against the nix-built binary |

`server` does not depend on `web`: it serves a built bundle it is handed (`OLAI_DIST_DIR`, the one place either of them names it), so the browser build is a build artifact rather than an import.

**Owed upstream.** `packages/server/src/listener.ts` sequences an origin gate, an upgrade, a stale-tab check, heartbeat enrolment and a serving stack — the same sequence, in the same order, as kolu's own surface-app example. That is a `serveSurfaceApp({surface, handlers, clientDist, host, port, allowedOrigins})` primitive belonging in `@kolu/surface-app`, beside the `surfaceAppLayer` and `acceptSurfaceSocket` it already owns. Until it exists, two copies are kept in step by hand, which is exactly the volatility a receptacle is supposed to contain.

## Errors

Error kinds (`usage`, `validation`, `not-found`, `derived`, `busy`) are `Schema.TaggedErrorClass`es — schemas that travel the wire and decode as themselves — surfaced as MCP tool errors and HTTP codes. Every validation error names `file:line`. Errors that teach are the product: a refused derived-state write lists the unfinished children as structured data.

Validation is staged, and the stage is part of the taxonomy (`stageOf`): a file is decoded whole or not at all, and the set-wide rules do not run until every file parses. "`kitchen` is not a known id" is a guess when the line declaring `kitchen` is the one that failed to parse, so a report containing a per-line error says out loud that the set-wide questions have not been asked yet.
