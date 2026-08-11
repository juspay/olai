# Viewing over surface-mcp

Status: BUILT. Approved 2026-08-11 and delivered the same day; the implementation log at the foot of this file records what landed, what the upstream ruling changed, and the four SDK behaviours that had to be closed on olai's side. It also served as the spec for the upstream kolu work (juspay/kolu#2155), which is merged and consumed. **Sections 0.2 and (c) below describe the gap as it stood BEFORE that PR and are kept as the record of why the migration waited** — they are history now, not current behaviour. Written for roadmap item `surface-mcp-viewing` (child of `surface-mcp`), design-first by instruction. Every claim about `@kolu/surface-mcp` below was verified against **the revision olai actually pins**, `580ab79e8cc7715103af4bddb35d5c9128f897dc` (`npins/sources.json`, 2026-08-10), read with `git show` out of the local kolu clone. Revised the same day to absorb the `snapshot-scale` requirement (roadmap `b794e1d`, on origin/master and not yet in this worktree).

Scope, from the roadmap node: olai's READ side. The surface's cells and collections exposed as subscribable MCP resources behind a default-deny `expose` list; the existing query tools riding as bespoke tools; write tools keeping their current path. Both deployment shapes — serve-fresh for `olai mcp <dir>`, bridge for a session attached to a running server.

---

## 0. Two findings that shape everything

### 0.1 The pin is on Effect Schema, and that is the good news

At `580ab79e`, `packages/surface-mcp/package.json` declares `effect@4.0.0-beta.106` and no zod. Its `jsonschema.ts` bridges Effect Schema → JSON Schema via `Schema.toJsonSchemaDocument` (draft 2020-12, the dialect MCP standardized on) with host-compatibility glue olai's hand-rolled `describe()` does not have: it reopens every object (Effect emits `additionalProperties: false`, which is an outright break for several hosts), normalizes `Schema.Number`'s Infinity/NaN-tolerant union back to its numeric arm, and special-cases `Schema.Void`/`Schema.Undefined`. That is strictly better than `packages/ops/src/mcp.ts:159-179`.

**A trap for anyone re-deriving this.** The local kolu checkout's `master` worktree (`/home/srid/code/kolu/.worktrees/master`, HEAD `482c4f3ff`, 2026-08-05) is *older* than the pin and still has surface-mcp on **zod**. Reading it produces a design premised on a schema-library mismatch that does not exist. Always read at the pinned rev.

### 0.2 `structuredContent` does not exist in surface-mcp, and cannot be added from olai's side

`packages/surface-mcp/src/tools.ts` is the whole result vocabulary:

```ts
export interface ToolResult {
  content: { type: "text"; text: string }[]
  isError?: boolean
}
export function ok(data: unknown): ToolResult {
  const payload = data === undefined ? null : data
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] }
}
export function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true }
}
```

No `structuredContent`, on either arm. A failing procedure or bespoke handler rejects, and `failFrom` (`server.ts:1064`) squashes it to `e instanceof Error ? e.message : String(e)`. The reference doc states this as intended: *"a rejecting handler … always returns an `isError` tool result carrying the message, never a JSON-RPC protocol error."*

Olai's contract is the opposite, and it is argued at length in `packages/ops/src/mcp.ts:19-25`: a refusal is an answer, and it has to reach the model *with its structured detail in `structuredContent`*, so "these three children are not done" arrives as data rather than a sentence to parse. That is not aspiration — it is load-bearing across the test suite:

- `packages/server/src/mcp/serve.test.ts:187` — `expect(refused.result?.structuredContent).toMatchObject({ kind: "not-found" })`
- `packages/ops/src/ops.test.ts:340,468,524,543` — four sites
- `packages/tests/step_definitions/external_agent_steps.ts:11,27` — *"Every tool answer is read from `structuredContent`, never from the prose"*
- `packages/tests/agent/fake-acp-agent.ts:350,362`

Both arms lose it, not just the failure arm: `ok()` emits `content` only, so the **read** tools lose their structured answer too.

**Therefore the roadmap's phrase "the existing query tools ride as bespoke tools *unchanged*" is not achievable at this pin.** A `BespokeTool.handler` returns `Effect<O, unknown>` and the adapter wraps the result with `ok()`; there is no hook, no override, no return shape that survives. This is the single decision that gates the whole item, and it is treated as such in §c and §f.

---

## (a) Which cells go in the expose list

### The rule this design contributes

> **An expose-map entry is a wire-cost commitment, not only an authz one.** A cell is exposable iff its value is O(1)-ish; anything O(corpus) must be a collection, where the projection reads keys cheaply and bodies one at a time.

That rule falls straight out of the adapter. In `server.ts:resolveCall`:

```ts
const proc = entry.kind === "collection" ? ns.keys : ns.get
```

A collection's `surface://collections/<k>` resource reads **`keys` only** — the key set, never the contents; there is no verb in the adapter that reads a collection whole. A cell's resource reads `get` — the entire value, every time, and every `notifications/resources/updated` invites a full re-read. **surface-mcp's collection projection is inherently lazy; its cell projection is inherently eager.**

### The list

Now, in this slice — `packages/server/src/mcp/expose.ts`, new, ~40 lines including the rationale above:

```ts
export const EXPOSE: ExposeMap<typeof surface.spec> = {
  outlines: "resource",   // keys = file paths; surface://collections/outlines/{id} = one file
  errors:   "resource",   // cross-file validation state
}
```

After `snapshot-scale` lands, one added line:

```ts
  documents: "resource",  // keys = .md paths; surface://collections/documents/{id} = one body
```

| member | now | later | why |
| --- | --- | --- | --- |
| `outlines` (collection) | yes | yes | The item. Key-set resource = the file list; `surface://collections/outlines/notes/todo.jsonl` = that file's `{rev, nodes, broken}` — **the same rows the browser draws**, subscribable. Never O(corpus): the key-set read is paths, the item read is one file. `rev` comes with it, which is exactly the base a phase-4 write names, so this pre-pays the parent item. |
| `errors` (cell) | yes | yes | "What is wrong right now", set-wide — it lets an agent notice it is reading a stale-but-valid tree under a banner. Bounded in practice: per-file breakage already rides `OutlineEntry.broken` on the collection, so this cell holds cross-file failures only. Flagged as the *lesser* instance of the wire-cost rule — a corpus that ever produces thousands of cross-file errors wants the same treatment `manifest` gets below. |
| `manifest` (cell) | **no** | **no** | See §a.1. Never exposed, at any point in the sequence. |
| `documents` (collection) | — | yes | Does not exist yet. Two lines when it does — §snapshot-scale. |
| `chat` (cell) | no | no | The human's session state. An external agent has no business watching it; the internal agent watching its own state is a feedback loop. |
| `transcript` (collection) | no | no | The human's conversation. A straightforward leak to an agent that is not ours. |
| `chat.*` (procedures) | no | no | Default-deny is the mechanism; omission is the whole implementation. |

### a.1 Why `manifest` is never exposed

`Manifest = Schema.NullOr(Schema.Struct({ documents: Schema.Array(Document) }))` (`packages/surface/src/index.ts:114`) and `Document = Schema.Struct({ file, text })` (`packages/format/src/documents.ts:44`). The cell is *nothing but* the corpus of `.md` bodies.

Exposing it would hand an agent `surface://cells/manifest` = every document body in the served directory as one JSON blob, re-read in full on every document edit. That is `snapshot-scale`'s exact defect reproduced on the agent wire, with none of the browser's mitigations.

And after `snapshot-scale`, `manifest` holds only the never-loaded bit — which an agent does not need. `resources/read` on a cell blocks on `firstFrameOrThrow`, and a collection's key-set read blocks the same way, so "the store has not loaded yet" is absorbed by the read waiting rather than needing a tri-state. Request-shaped consumers do not need the bit that render-shaped ones do.

So `manifest` is O(corpus) today and empty of anything an agent wants tomorrow. It never enters the map, which means **no URI is published and later withdrawn**.

### a.2 What this shape buys, beyond authz

Today `list_outlines` is a *poll*. As a resource, a change to the key set is **pushed** (`notifications/resources/updated` via `pusher.ts`) and the agent re-reads. An agent watching one file subscribes `surface://collections/outlines/<path>` and is told when that file moves. That is the actual "viewing" win, and it is the thing the hand-rolled dispatch cannot do at all — `packages/ops/src/mcp.ts` implements four methods and one notification, with no resource half and no server-initiated push (`packages/server/src/mcp/route.ts:6-9` answers the SSE half with a 405 for exactly that reason).

Nested collection keys address fine in the URI, encoded or not: `parseCollectionItem` slices after `surface://collections/`, splits on the **first** `/` only, then `decodeURIComponent`s each half — so `surface://collections/outlines/notes/todo.jsonl` resolves to key `outlines`, id `notes/todo.jsonl`, and the percent-encoded spelling resolves identically.

---

## (b) serve-fresh and bridge

### b.1 serve-fresh — `olai mcp <dir>`, no server running

`packages/server/src/mcp/serve.ts` gains three lines of composition and loses a transport:

```
openDirectory → makeOps → bind({ store, chat: null })         // runtime.ts, unchanged, already null-safe
              → buildSurfaceFace(surface, directDispatch(runtime))
              → serveSurfaceAsMcp({ surface, client: () => face, expose: EXPOSE,
                                    tools: BESPOKE, serverInfo, /* stdio default */ })
```

`bind` (`packages/server/src/runtime.ts:71`) already takes `chat: null` and answers chat verbs as `UsageFailure` refusals, so nothing there changes. `packages/server/src/mcp/stdio.ts` (83 lines) **deletes** — `StdioServerTransport` replaces the hand-written pump.

Cost: `olai mcp` now runs the surface runtime's connector fiber (one `Stream.runForEach` over `store.snapshot`), which `olai web` already runs. Negligible.

One wart to expect at the call site:

```ts
client: () => face as unknown as SurfaceClientCallable
```

This is upstream's own documented idiom — `packages/surface/example/snippets/mcp.ts` carries the same cast with the comment *"the cast is surface-mcp's own idiom today … reconciling the two spellings is a framework follow-up"*: `buildSurfaceFace` types member leaves `unknown` (the face is structural by design), while the adapter wants them callable.

### b.2 bridge — attached to the running server

Three things olai does not have today: a way to find the server, a transport to dial, and auth on it.

**Do not use the websocket.** It is origin-gated for browsers (`allowedOrigins`, `packages/server/src/allowedOrigins.ts`), and a Node dialer sends no `Origin` header — you would be reasoning about the gate's missing-header behaviour in order to authenticate an agent.

**Use a unix socket**, which kolu already ships end to end at the pin:

- `packages/server/src/serve.ts`: after `listen`, also call `serveOverUnixSocket({ socketPath, group: wired.bound.group, handlers: wired.bound.handlers, log })` at `getRuntimeSocketPath({ app: "olai", file: `${digest(root)}.sock` })` — both from `@kolu/surface/unix-socket`. The directory is created `0700` and then *verified* owner-only with a symlink-rejecting `lstatSync` (an attacker pre-creating `/tmp/olai-$UID` as a symlink is the case it defends). **Filesystem permissions are the auth** — no token, no port, no origin gate.
- `packages/server/src/mcp/serve.ts`: `unixSocketLink({ group: surface.group, socketPath })` from `@kolu/surface/links/unix-socket`. A dial failure **is** the discovery answer — the link's own docstring says `ECONNREFUSED`/`ENOENT` is how every daemon probe in kolu's tree reads "nothing is serving" — so `olai mcp` falls through to serve-fresh with no state file, no PID file, and no staleness logic. `probeSocket` even clears a provably-dead socket inode on the serving side.
- Return an `OwnedSurfaceConnection` (`{ client, dispose, onClose }`) so the adapter closes the socket on teardown and re-dials eagerly when the server restarts, rather than discovering it by spending a request on a dead socket (juspay/kolu#2082).

The socket file must be keyed by a digest of the **served root**, not by a fixed name: two `olai web` processes on different directories must not collide.

### b.3 Can the second store be retired when a server is live?

**Yes for reads. For writes, only at a price — and naming that price is the honest answer.**

Bridged, there is no `ops` in the `olai mcp` process, so the write tools have nothing to call. Two ways out:

1. **Forward writes over the existing `/mcp` HTTP route.** Needs the running server's URL *and* its per-process token (`serve.ts:93`) to reach the bridge — which means a state file after all, carrying a secret, undoing the "socket permissions are the auth" simplicity. ~40 lines plus a secret on disk.
2. **Bridge is read-only; writes stay serve-fresh.** Then an attached session has no write tools, which is not the product.

This is the parent item's decision, not this one's. Once writes are surface procedures, the bridge carries them over the same socket and both the token and the state file evaporate.

**Recommendation: ship serve-fresh in this slice. Put the bridge behind an explicit `olai mcp --attach` and land it with the parent item.** Today's two-stores arrangement is not an accident — it is argued at `packages/server/src/mcp/serve.ts:9-27`: the write gate PROBES before it judges, so a change another process made is part of the revision a write is checked against, and a moved base returns `StaleWrite` for the ops layer to re-plan against. That argument still holds; nothing in this design invalidates it. What the bridge buys over it is one store and live rows; what it costs is discovery, a fallback path, and (for writes) a secret on disk.

---

## (c) Refusal / error encoding parity

**Parity does not hold, in either direction, and it cannot be patched from olai's side.** See §0.2 for the evidence. `ok()`/`fail()` are internal to `serveSurfaceAsMcp`; a bespoke handler's return value is passed *through* them, so there is no seam.

Three ways forward:

| | shape | verdict |
| --- | --- | --- |
| **A. Upstream first** | Add `structuredContent?: unknown` to `ToolResult`; have `ok()` populate it when the payload is an object — exactly what `packages/ops/src/mcp.ts:184-187` already does — and give a bespoke failure a structured channel. Then all of olai's tools become bespoke over the existing `TOOLS` table: one face, one dispatch, parity preserved. | **Recommended.** Small, principled, and MCP 2025-06-18 has `structuredContent` as a first-class field — kolu is currently *below spec* here, not merely different from olai. |
| **B. Override the returned `Server`** | `serveSurfaceAsMcp` hands back the SDK's low-level `Server`, and `setRequestHandler` overwrites by key — so olai could re-register `tools/list` and `tools/call` with its own framing and use surface-mcp purely for resources. Zero upstream. | Works, and it is the escape hatch if upstream stalls. But it reaches around the library's public API, permanently forgoes its tool machinery, and **cannot restore `instructions`** (below). Documented fallback, not the plan. |
| **C. Two MCP servers** | Keep `Mcp.make` for tools, add a second resources-only entry. | **Rejected.** `olai mcp` has one stdio pipe, so this means a second process — and the two stores are back, which is the thing the bridge existed to remove. |

**A second parity item, smaller but real.** `serveSurfaceAsMcp` builds `new Server(opts.serverInfo ?? DEFAULT_SERVER_INFO, { capabilities: { tools: {}, resources: { subscribe: true } } })` and never passes `instructions`. Olai's `initialize` returns a paragraph that is doing actual work (`packages/ops/src/mcp.ts:78-82`): *"Everything here is about NODES, not files … There is no file access — a node is the smallest thing you can name, and that is deliberate."* `initialize` is handled inside the SDK's `Protocol`, not through `setRequestHandler`, so this is **not** recoverable via option B. Upstream passthrough is required either way.

---

## (d) The chat panel's internal HTTP+token route vs injectable transports

Solvable cleanly — better than the roadmap's "considerations" list implies.

`ServeSurfaceAsMcpOptions.transport?: Transport` is injectable (`server.ts:114`), defaulting to `StdioServerTransport`. The MCP SDK ships `StreamableHTTPServerTransport`, whose `handleRequest(req, res, parsedBody)` takes raw node objects. And `@effect/platform-node@4.0.0-beta.106` — already a root dependency — exports exactly the two adapters needed (verified in its `src/NodeHttpServerRequest.ts`):

```ts
NodeHttpServerRequest.toIncomingMessage(request)   // → http.IncomingMessage
NodeHttpServerRequest.toServerResponse(request)    // → http.ServerResponse
```

So `packages/server/src/mcp/route.ts` keeps its shape. The bearer-token check stays verbatim (`route.ts:54`), the 405-on-GET stays, `MCP_PATH` stays, and the `serve.ts` plumbing at `:93`, `:124` and `:148` is untouched. Only the body changes: hand the node pair to the transport instead of calling `options.server.handle(body)`. Roughly 15 lines, and **no hand-rolled `Transport` shim** — which was the risk worth checking, since implementing the SDK's `Transport` interface over Effect's `HttpServerResponse` by hand would have meant pairing requests to replies by JSON-RPC id.

`Mcp.parseError` (`packages/ops/src/mcp.ts:223`, the one frame a transport has to build itself) becomes dead if the whole dispatch goes; it survives only under option B.

---

## (e) Pin discipline and hydration

**`scripts/check-kolu-deps.sh` needs no change at all.** It consumes `$OLAI_KOLU_DIRS`, which the dev shell derives from `sourceDirs` in `nix/kolu.nix`, which derives from `names`. The roadmap assumed the script would need extending; by construction it does not. The whole of (e) is:

1. `nix/kolu.nix` — one word:
   ```nix
   names = [ "surface" "surface-app" "log" "url-shape" "surface-mcp" ];
   ```
   The overlay attrs, the flake `packages` output, the hydrate argv and `sourceDirs` all derive from that list. `@kolu/surface-mcp` declares `@kolu/surface` as `workspace:*`, and `surface` is already hydrated, so the sibling half of the check passes.

2. Root `package.json` `dependencies`, at kolu's **verbatim** version strings — the script compares them literally (`select(($root[.key] // "") != .value)`):
   ```json
   "@modelcontextprotocol/sdk": "^1.29.0",
   "ts-pattern": "^5.9.0"
   ```
   `effect@4.0.0-beta.106` already matches. I checked every import in the package: those two plus `effect` and `@kolu/surface/{define,errors,first-frame}` are the complete external set. **No new `@kolu/*` sibling to hydrate.**

3. `bun install`, then `just check` confirms or names the drift.

Surface-mcp's `devDependencies` (`@types/node`, `typescript`, `vitest`) are not checked — the script reads `dependencies` + `peerDependencies` only, which is correct here since olai type-checks the hydrated sources against its own root `node_modules`.

**The cost, stated honestly.** `packages/ops/src/mcp.ts:14-17` says the official SDK "would be a dependency for a hundred lines of dispatch we would still have to route ourselves." That judgement was right when it was made, and this reverses it — `@modelcontextprotocol/sdk` brings a transitive tree the hand-rolled dispatch was built to avoid. What buys the reversal is *not* the dispatch. It is the subscribe/notify lifecycle (`pusher.ts`, 334 lines), the snapshot-versus-held-open collection-item read (`firstFrameOfCollectionItem`, racing a `get` first frame against a live `keys`-absence watch — the juspay/kolu#1681 case), and the host-compatibility schema glue of §0.1. None of those are things olai should write, and all three are exactly what the read side needs.

---

## (f) Migration order

| # | package | change |
| --- | --- | --- |
| 0 | **upstream kolu** | PR: `structuredContent` on `ToolResult`/`ok`/`fail`; `instructions` passthrough on `ServeSurfaceAsMcpOptions`. Then re-pin `npins/sources.json`. **Gate for everything below.** |
| 1 | `nix/`, root | `names` += `surface-mcp`; two root deps at kolu's verbatim specs; `bun install`; `just check`. |
| 2 | `@olai/ops` | **`tools.ts` stays and becomes more load-bearing.** It is already the one declaration of name/title/description/schema/reader/fixed (`packages/ops/src/tools.ts:19-25` argues exactly that). Add `bespokeFrom(TOOLS, ops): Record<string, BespokeTool>` — a mechanical projection: a read tool becomes `Effect.map(ops.read, at => tool.read(at, args))` with `mutates: false`; a write tool becomes `ops.run(request)` with `mutates` left at its conservative default. Writes keep going through `plan.ts`, the write gate and `onRefusal` — **"writes stay on the current dispatch" means the current *path*, which is untouched.** |
| 3 | `@olai/ops` | `mcp.ts` **deletes** (227 lines); `index.ts` drops `export * as Mcp`. Under option B it shrinks to framing helpers instead. |
| 4 | `@olai/server` | New `mcp/expose.ts` (§a, with the wire-cost rule in its header). `mcp/serve.ts` rewired to `bind` + `directDispatch` + `serveSurfaceAsMcp`. `mcp/stdio.ts` **deletes** (83 lines). `mcp/route.ts` body swapped for `StreamableHTTPServerTransport` (§d); token, `MCP_PATH` and the 405 unchanged. `serve.ts` largely unchanged. |
| 5 | `@olai/surface` | **nothing.** The declaration is already right. |
| 6 | `packages/tests`, unit tests | `ops/src/ops.test.ts` and `server/src/mcp/serve.test.ts` move from hand-fed JSON-RPC frames to the SDK's `InMemoryTransport` (the `transport?` option exists for this). The BDD harnesses (`external_agent_steps.ts`, `fake-acp-agent.ts`) should need **no change** — that is the acceptance test for step 0. New: subscribe `surface://collections/outlines/<file>`, write via a tool, assert `notifications/resources/updated` arrives. New fence: `resources/read` on `surface://collections/outlines` returns *paths only*, asserted by size — the regression guard that makes §a's wire-cost rule enforced rather than remembered. |
| 7 | docs | `docs/architecture.md`; `packages/ops/README.md` (line 156 names `structuredContent`); `packages/server/README.md`; root `README.md`. |

Nothing in steps 2–7 lands before step 0 is verified green.

**Net:** roughly −310 lines of olai transport and dispatch, +2 lines of expose list, and agents get pushed outline updates.

---

## snapshot-scale: designing against documents-as-collection

Roadmap `snapshot-scale` (filed 2026-08-11, `b794e1d`) makes it a requirement that olai support directories with thousands of `.md` files, and specifies the shape: documents become a collection, the first snapshot carries only what the sidebar draws, and a body travels when a document is opened.

That requirement is what produced §a's wire-cost rule and the removal of `manifest` from the expose list. The rest of this design is unaffected: (b), (c), (d), (e) and (f) stand as written.

### What changes, and when

Nothing is published and then withdrawn. The transition is purely additive:

- **Now** — `{ outlines, errors }`. An agent gets no view of `.md` documents. That is **not a regression**: the current tool table (`list_outlines`, `search_nodes`, `read_node`, `read_subtree` — `packages/ops/src/tools.ts`) is outlines-only, so documents have never been agent-visible. The capability arrives once, in its final shape.
- **When snapshot-scale lands** — add `documents: "resource"` and one resource test. One line.

### Design input flowing back to snapshot-scale

Cheap to honour, and worth honouring because surface-mcp's templated-resource projection is exactly the shape being asked for:

1. **One `documents` collection, not a head/body pair.** surface-mcp maps one collection → one key-set resource + one item template. Two collections (heads plus bodies) would make an agent read two resources to assemble one document, and the head collection would be the O(corpus) push again if it carried `deltas`.
2. **The entry carries the body** — `DocumentEntry = { rev, text }`, plus whatever preview the browser proves it needs. Then `surface://collections/documents/notes/design.md` is exactly one document, read on demand.
3. **`keys` + `get`; `deltas` omitted or deliberate.** The sidebar needs paths only — `packages/web/src/client/fileTree.ts:113` does `put(root, file, "document")` with no title, so the key set alone already draws it. `DocRef.tsx`'s inline preview is a per-visible-node `get`, which is lazy and correct. If a preview line for many nodes at once turns out to be needed, add a small separate head member *after measuring*, not before.
4. `keySchema: Schema.String`, root-relative, `/`-spelled — the same spelling `outlines` uses, and the same spelling every `file:line` uses.

Of these, (3) is the one where the browser's needs and the agent's could diverge and is genuinely snapshot-scale's call; (1) and (2) are free; (4) is already the convention.

### Should the two be one piece of work?

**No — keep them separate, and let snapshot-scale go first or in parallel.**

The overlap is zero code. snapshot-scale touches `@olai/surface`'s declaration, `packages/server/src/outlines.ts`, and the browser (`DocumentsProvider`, `DocRef`, `fileTree`). surface-mcp-viewing touches `packages/server/src/mcp/*`, `packages/ops/`, `nix/`, and root deps. Disjoint files, disjoint tests.

The decisive argument is the gate asymmetry: **surface-mcp-viewing is blocked on an upstream kolu PR** (§c); snapshot-scale is blocked on nothing and is a stated hard requirement. Bundling them makes a "must support thousands of files" fix wait on a third-party merge. That is the wrong way round.

The dependency between them is one-directional and satisfied by a single omission — not exposing `manifest` — which costs nothing and creates no rework.

### Sequencing

| | work | gated on |
| --- | --- | --- |
| **A** | snapshot-scale: documents → collection, lazy bodies | nothing — start whenever |
| **B** | upstream kolu: `structuredContent` + `instructions` passthrough | kolu review |
| **C** | surface-mcp-viewing, serve-fresh, `{ outlines, errors }` | B |
| **D** | `documents: "resource"` + a resource test | A **and** C — one line, lands with the later of the two |
| **E** | bridge, and writes as surface procedures | the parent `surface-mcp` item |

A and B run concurrently; neither waits on the other.

---

## Owed upstream to kolu

1. **`structuredContent` on `ToolResult`** — *blocking*. `ok()` should mirror MCP 2025-06-18's structured field the way `packages/ops/src/mcp.ts:184-187` does, and a failing bespoke tool needs a structured channel rather than only `e.message`. This is a spec-conformance gap, not a preference: hosts read `structuredContent`, and surface-mcp already has the object in hand at the moment it stringifies it.
2. **`instructions` passthrough** — *blocking-ish*. Currently unreachable, because `initialize` is served inside the SDK's `Protocol` and no consumer-side workaround exists (§c).
3. ~~**The `SurfaceClientCallable` cast**~~ — **DECLINED upstream, 2026-08-11, and correctly.** Widening the adapter's client type collides with kolu's documented TS2590 dodge: re-materializing a precise `SurfaceClientOf<S>` inside the framework overflows TypeScript's union budget, which is the whole reason `buildSurfaceFace` leaves its member leaves `unknown` in the first place. The sanctioned shape is the consumer's, not the framework's — each consumer declares the narrow face it actually calls, exactly as `@kolu/padi` declares `PadiSurfaceClient`, and the one structural cast lives in a named boundary function. olai now does this (`OlaiSurfaceClient` + `clientOver` in `packages/server/src/mcp/face.ts`), and it is strictly better than what was asked for: the ask would have bought a cast-free call site with untyped leaves, while this gives typed leaves *and* a cast-free call site. Verified load-bearing — a wrong key type, an unknown member, and a write verb on a read face are each a compile error.
4. **Roadmap hygiene, not upstream:** the `surface-mcp-viewing` node's sequencing note is stale. PRs #90 and #89 have both landed (`4198452`, `cddb778`), so the `Place`/`Situated`/`NodeLine` wire shapes this projection exposes are settled and implementation is unblocked on olai's side.

---

## Recommendation

Adopt, with the shape above:

- File upstream asks (1) and (2) against kolu now.
- Start `snapshot-scale` immediately and independently; give its `documents` collection the one-collection / body-in-entry / keys-first shape.
- When the upstream PR lands and the pin moves, do steps 1–7 as one PR migrating **both** faces — `olai mcp` stdio and the internal HTTP route — onto one `serveSurfaceAsMcp`, with all of olai's tools riding as bespoke over the existing `TOOLS` table and `{ outlines, errors }` exposed as resources.
- Hold the bridge for the parent item: it only retires the second store if writes cross it too, and until writes are surface procedures that means shipping the server's token in a state file — trading a clean permission boundary for a secret on disk, to solve a problem the write gate already handles.

If waiting on upstream is unacceptable, option B (§c) delivers the resource half today with full tool parity, at the cost of losing `instructions` and permanently forgoing surface-mcp's tool machinery. Not recommended, but real — and it is what I would build if the upstream PR stalls.

---

## Implementation log

Approved 2026-08-11 as designed. The branch is built so the upstream-gated part is the LAST commit and nothing before it depends on the gate.

| commit | what | gated |
| --- | --- | --- |
| `9163310` | `@kolu/surface-mcp` hydrated; `@modelcontextprotocol/sdk` + `ts-pattern` at kolu's versions; `bun.lock`/`bun.nix` regenerated | no |
| `6cd0532` | `packages/server/src/mcp/expose.ts` — the two-member allowlist — and `expose.test.ts` | no |
| `28f659e` | `packages/server/src/mcp/face.ts` — serve-fresh — and `face.test.ts`, including the wire-cost fence | no |
| `9d9658f` | `OlaiSurfaceClient` + `clientOver`: the client typed off the spec instead of cast at the adapter's door (upstream ask 3, closed here) | no |
| `a573251` | kolu pin bumped to `4e3b757` (juspay/kolu#2155) | — |
| `691b797` | `bespokeFrom(TOOLS, ops)` carrying name/title/description; `olai mcp` and the `/mcp` route flipped onto the face; `ops/src/mcp.ts` and `mcp/stdio.ts` deleted | was the gate; **closed** |
| `8de93e4` | `documents: "resource"` — step D of the sequencing table, once `snapshot-scale` landed | — |

### Closing the gate: what the SDK does not do that the pump did

The upstream half arrived exactly as specified. The olai half turned up four
behaviours the hand-rolled transport had provided for free, each found by a test
that already existed, and each is worth recording because none of them is
visible from the adapter's API:

1. **The stdio transport never notices stdin ENDING.** It attaches listeners for
   `data` and `error` and nothing else, so `olai mcp` outlived its client and sat
   holding a watcher on somebody's notes directory.
2. **And it does not DRAIN.** The old pump answered lines through
   `Stream.runForEach`, which awaits each reply before reading the next, so when
   the stream ended every message had been answered. Closing on `end` alone
   exited before a single frame was written. The end of stdin now ARMS a shutdown
   that the last reply performs — requests counted in, replies counted out.
3. **The Streamable HTTP transport fits neither of its modes.** Stateless refuses
   reuse ("create a new transport per request"), and a transport per request is a
   `Server` per request, because an MCP `Server` binds exactly one — that would
   rebuild the face, its expose walk and its resource pusher on every call.
   Stateful keeps one transport but issues an `Mcp-Session-Id` clients must echo,
   which this endpoint has never required. Both prefer SSE, which a client that
   called `response.json()` waits on forever — the failure the e2e chat scenarios
   actually showed. So the route keeps a small half-duplex transport of its own.
   That is not a retreat from the migration: what was bought upstream is the
   SERVER, and `serveSurfaceAsMcp` takes a transport as an option precisely
   because the shape of the pipe is the embedder's business.
4. **`Schema.Struct({})` is not an object to the schema bridge.** Effect compiles
   it to `anyOf: [object, array]`, so a no-argument tool was advertised wrapped
   under `value` and every call refused with "Expected object | array".
   `list_outlines` is that tool and it is the first call an agent makes, so this
   was the entire capture flow. Fixed by giving a tool that takes nothing no
   input schema at all, which is the honest spelling — and fenced by a test.

`route.ts` had no test before this, which is how (3) reached the e2e suite. It
has one now, over real HTTP on olai's real listener.

**One deliberate behaviour change**: an unknown tool is an `isError` result
rather than JSON-RPC `-32602`. That is the SDK's convention and the better one —
a model that named a tool it does not have can read the answer and pick another,
where a protocol error throws inside its client. A second, smaller one: a write
tool is now advertised `destructiveHint: true` (the adapter derives both hints
from `mutates`) where the old `describe()` said `false` for everything.

### Where the projection lives, and why it moved

`bespokeFrom` is in `@olai/server`, not beside the table in `@olai/ops`. The
table was private because that package owned an MCP server, and "what a consumer
wants is the server, and the list is what the server is made of". Both halves
stopped being true at once: the server is the framework's now, so the list IS
what a consumer wants — and the framework brings the MCP SDK, which would put
express, hono and ajv in the dependency closure of a package whose own manifest
says it knows "nothing about a listener, a socket or a browser". The ops tests
for the tool surface moved with it and got stronger: they run through a real MCP
client instead of a dispatch function.

### Corrections and findings from building it

- **The dependency cost, measured rather than estimated: 385 → 474 installed packages.** The SDK brings express, hono, ajv, cors, jose, zod, eventsource and pkce-challenge, none of which olai reaches. (A cold `bun install` prints "846 packages", which is the resolve-tree count, not the installed set — do not quote that number.)
- **`scripts/check-kolu-deps.sh` needed no change, as predicted**, and passed on the first run with the new package and its two deps. §e stands exactly as written.
- **The projection was confirmed against olai's real spec before any wiring**: `resolveExpose(surface.spec, EXPOSE)` yields `surface://collections/outlines` (kind `collection`), `surface://cells/errors` (kind `cell`), the template `surface://collections/outlines/{id}`, and zero tools. The Effect-Schema pin accepts olai's surface with no adapter of our own.
- **The wire-cost claim is now a fence, not a paragraph.** `face.test.ts` serves a directory holding a ~40 KiB `.md` and asserts that reading the outlines collection comes back under a kilobyte and contains no byte of that body. This is the assertion that catches a future `manifest`-shaped mistake, and it exists because the eager/lazy split is a property of the *adapter's* verb choice and is invisible from the expose map.
- **A finding the design did not anticipate**: the surface runtime's `done` promise REJECTS when it is closed, so any test standing a runtime up without `watchFault` holding that catch produces an unhandled rejection attributed to whichever test was running. `fault.ts` is not optional ceremony for `serve.ts` — it is what makes the runtime testable at all. The harness mirrors `serve.ts`'s finalizer ordering (`stopped` registered last so it runs first) for the same reason.
- **`resources/read` narrowing**: MCP types a resource content as text-or-blob. The adapter only ever emits text, so the test narrows by throwing on a blob rather than handling one. Caught by `tsc`, not by a passing test.

### The upstream ruling, 2026-08-11

kolu approved the design with **ask (3) declined**, the other two accepted, and one addition offered. Net effect on this branch:

| ask | outcome | what it means here |
| --- | --- | --- |
| (1) `structuredContent` | accepted, arriving as **`ToolFailure`** (`isError` + `structuredContent`) | The gate. Still the last commit slot. |
| (2) `instructions` passthrough | accepted | `initialize` keeps olai's "everything here is about NODES, not files" paragraph. |
| (3) `SurfaceClientCallable` widening | **declined** | Fixed on olai's side instead, and better — see the struck-through entry above. **Already landed** (`9d9658f`), so this branch no longer waits on it. |
| — | **`title` on `BespokeTool`** (new, offered) | Unanticipated and welcome. `@olai/ops`' `TOOLS` table carries a `title` per tool that today's `describe()` emits, and without this it would have been silently dropped in migration. `bespokeFrom` can now project name, title AND description, so the table stays the single declaration it claims to be. |

### What is still owed

Nothing. All four asks are closed: (1) `ToolFailure` and (2) `instructions` landed in juspay/kolu#2155 and are consumed here; (3) was declined and fixed on olai's side; (4) `title` arrived unasked and is carried. The bridge shape and writes-as-procedures remain the PARENT item's, as designed.

One observation worth passing upstream, not a blocker: `failFrom` brands every failure `surface-mcp: …`, including a `ToolFailure`, whose message the CONSUMER wrote deliberately. The module's own rule is that the adapter brands what it raised; a consumer's refusal is not that. So olai's refusals currently reach an agent as "surface-mcp: `set_done` was refused (not-found): …". Cosmetic, and no test depends on the prose.

---

## Review round, 2026-08-11

An opposite-model review on PR #94 raised no architectural objection and set a
merge gate of two required and two recommended items. All four are taken.

**Required.**

1. **`destructiveHint` is pinned.** The annotations test now asserts BOTH hints
   for a read and a write (`search_nodes` true/false, `set_done` false/true).
   This was the review's sharpest catch: the design log named the change and the
   suite did not fence it, so a future "simplification" back to the old blanket
   `destructiveHint: false` would have shipped silently — and hosts key off that
   field for confirm-before-run and tool grouping.
2. **Two false comments fixed.** `serve.ts` said "The SDK's stdio transport ends
   when stdin does" directly above the wrapper that exists *because it does not*
   — an invitation to delete the wrapper as redundant. And `serve.test.ts`'s
   header still cited the deleted `stdio.test.ts` for framing, and claimed "the
   pump answers in order", which the SDK's transport does not promise.

**Recommended, both taken rather than accepted as risk.**

3. **`list_outlines` over the real child pipe** (`serve.test.ts`). The
   `Schema.Struct({})` wrapping bug was a property of the schema bridge and so
   transport-independent — but that was a claim, and this is the cheap way to
   hold it. Asserts both the advertisement (empty object, no `value`) and the
   call.
4. **Non-object bodies are refused, not 202-silenced.** `null`, `42`, `[]` and a
   bare string parse as JSON but are not messages; the SDK's `Protocol` reports
   them to `onerror` and never replies, which through a half-duplex transport is
   a 202 and a client waiting for a frame that is not coming. The old dispatch
   answered `-32600`, so that judgement is back at the edge where it always was.
   Chosen over the review's alternative of documenting garbage-in as
   out-of-contract: silence is the worse failure mode.

**One thing taken beyond the gate**, because it was a hang in code this PR now
owns: a second `ask` under an id already in flight used to `set` over the first
waiter's resolver, leaving that POST unanswered until the process died. It is
now refused, and the guard has a deterministic transport-level test (through
HTTP the two requests would almost never actually overlap).

**Recorded, not acted on.** The review noted a silent wire change the design log
had missed: the hand-rolled `describe()` emitted `additionalProperties: false`
and kolu's bridge deliberately reopens objects, because several hosts break on
the closed form. That is the bridge doing its job — but it IS a change to what
olai advertises, and it belongs in the record beside the other two.

Also corrected: the PR description said `route.ts` gained "one test". It gained
four, and now six.
