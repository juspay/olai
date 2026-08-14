# One surface for browser and agents: what is left

Audit of the `surface-mcp` roadmap node, 2026-08-14. The node says its adoption
LARGELY LANDED and that it now holds "the remaining design positions". This
checks that claim against master, closes what turned out to be open, and names
what the node should shrink to.

The predecessor is [surface-mcp-viewing.md](./surface-mcp-viewing.md), which
designed and shipped the adoption itself (PR #94). Read that one for the
machinery; this one is only about what the parent still owed.

---

## The table

| # | position | verdict | receipt |
| --- | --- | --- | --- |
| a | the same verbs exist twice, two schemas free to drift | **CLOSED HERE** — one real instance, and it was live | `packages/ops/src/query.ts:140`, `packages/server/src/search.ts:45` |
| b | the refusal contract is verified — `isError` + `structuredContent` carrying `OpFailure` | **CLOSED HERE** — one kind of four was pinned, on one face of two | `packages/server/src/mcp/tools.test.ts:493,515`, `packages/server/src/mcp/route.test.ts:180` |
| c | the bridge shape exists — an agent attaching to a RUNNING olai's store | **DEFERRED, with a price and one upstream ask** | `packages/server/src/mcp/serve.ts:10` |
| d | agents watch live rows, not only call tools | **ALREADY TRUE** — five subscribable resources | `packages/server/src/mcp/expose.ts:119`, `mcp/face.test.ts:232` |
| e | `check-kolu-deps.sh` covers the package | **ALREADY TRUE** — by construction, and it always was | `nix/kolu.nix:27` |

Two of five were already true. Two were open and are closed in this PR. One is
a decision the human owns, and the rest of this document is the case for it.

---

## (a) Two schemas, free to drift — and one of them was drifting

The node's phrasing is "surface procedures vs MCP tools". Checked verb by verb,
the two faces overlap in exactly four places, and three of them are already
safe:

| verb | procedure | tool | shared declaration |
| --- | --- | --- | --- |
| commit | `git.commit` | `commit` (act) | `@olai/format`'s `CommitRequest` / `CommitResult` — ONE schema |
| push | `git.push` | `push` (act) | no input either side; `PushResult` from `@olai/format` |
| edit | `edit.apply` | the 18 write tools | not a duplicate: deliberately different vocabularies over one `Request` union (`packages/surface/src/edit.ts:1-130`) |
| **search** | `search.nodes` | `search_nodes` | **nothing** |

Search was the exception, and both halves of it were duplicated. The QUESTION
was spelled three times — the tool's own `SearchArgs`, `Query.search`'s inline
parameter type, and the wire spec's `SearchRequest`. The ANSWER was spelled
twice — `Query.Search`/`Query.Found` as TypeScript, `SearchAnswer`/`SearchHit`
as Effect Schema.

`@olai/surface`'s own header claimed this could not drift: *"the procedure's
implementation returns `Query.search`'s value where this schema's type is
demanded, so a field added to one side is a compile error on the other."* That
claim was false, and the check is one experiment:

> Add `readonly drifted: string` to `Query.Found` and produce it in `foundOf`.
> `just typecheck` passes on **all twelve packages.**

What happens next is the part that matters. `search_nodes` hands an agent the
ops layer's value verbatim as `structuredContent`, so the agent sees `drifted`.
The palette's procedure encodes that same value through `SearchAnswer`, which
has never heard of the field, so it is dropped. An agent and a person, searching
the same words in the same directory, looking at different rows — arriving
through the one seam nobody was watching, and silently.

**Closed:**

- the question is declared ONCE, in `query.ts` beside the function that answers
  it (`packages/ops/src/query.ts:140`), carrying the field prose that describes
  that function's own matching rule. `tools.ts` consumes it; the inline
  parameter is gone;
- the pair that CANNOT be merged is checked instead. `@olai/surface` may not
  import `@olai/ops` (a store has no business in a browser bundle) and
  `@olai/ops` may not import `@olai/surface` (an op does not know it is being
  called over a wire), so the two spellings are structural necessities. They are
  now asserted **identical** at the only module that sees both —
  `packages/server/src/search.ts`, which is also where the procedure binds;
- as **identity**, not assignability, and that distinction is the whole fence.
  An extra optional field is assignable in both directions. An extra required
  one fails only at whichever producer inside `@olai/ops` happens not to supply
  it — which, as the experiment shows, may be nowhere;
- a test encodes a real answer through the real procedure schema
  (`packages/server/src/search.test.ts`), because a schema is refinements as
  well as fields — `Schema.Int` on `line` and `total`, `Schema.Literals` on
  `status` and `matched` — and a type identity cannot see any of them.

Verified both ways: the fence fails on the drift above, naming itself.

**The general shape this leaves.** `agree.ts` is now a named place for "two
packages that may not import each other declare one thing twice". Today it has
two callers. It is worth knowing that the WRITE path would need it far more —
see (c).

---

## (b) The refusal contract: pinned for one kind, on one face

The contract is `packages/server/src/mcp/tools.ts:161`: a refused write comes
back as a successful call carrying `isError`, with `kindOf(failure)` and the
raiser's own `toJSON()` as `structuredContent`. That is what juspay/kolu#2155
was filed for, and it is correct.

What fenced it was `not-found`, over an `InMemoryTransport`
(`tools.test.ts:453`), plus two `usage` cases that arrived incidentally with
other subjects (`tools.test.ts:817,862`). Two gaps.

**The kind whose payload IS the point was not pinned.** Three of the four kinds
carry a sentence and at most an id. `validation` carries the validator's own
rows — `file`, `line`, `code`, `message` per finding — and that is the entire
argument for structured refusals: an agent fixes the one line that is wrong
instead of re-reading a directory it cannot parse. It is also the only kind
whose detail is an array of objects, hence the only one the schema bridge could
plausibly flatten on the way out.

Pinned now (`tools.test.ts:515`) over a set-wide break, on a READ and on a
WRITE — because the point of the kind is that a refused write and a broken file
on disk are explained by ONE report (`packages/format/src/failure.ts:58`) — and
the same rows are asserted to arrive on `surface://cells/errors`. That last
assertion is this roadmap node's own thesis at the one place it would actually
be felt: **an agent and a person looking at a broken directory are looking at
one report, in one vocabulary, at one instant.**

**And the transport olai wrote itself had no refusal test.** `mcp/route.ts` is
a half-duplex HTTP shape with a waiter table, built because neither of the SDK's
Streamable modes fits, and it is the pipe the chat panel's agent reads its
refusals through. It had a success-path `structuredContent` assertion and no
refusal one — leaving three failure modes an in-memory pair cannot have: an
HTTP status keyed off `isError`, a JSON-RPC `error` frame instead of a result,
or the structured half lost in the reply's serialization. Pinned
(`route.test.ts:180`).

**The four kinds are now closed at compile time** against `@olai/format`'s own
table (`tools.test.ts:493`): a fifth kind fails there, naming itself, rather
than reaching an agent as a word nothing pins. `busy` is named
unreachable-in-test rather than quietly absent — its only raiser is the write
loop giving up after `ROUNDS` re-plans, each overtaken by another writer, which
a test could only produce by standing up a store that rewrites itself
continuously.

---

## (c) The bridge: what it would cost to have, and what it costs not to have

Today the human runs `olai web <dir>` and, separately, `olai mcp <dir>`. Two
processes, two stores, one directory. `packages/server/src/mcp/serve.ts:10`
argues that this is safe, and it is right: the write gate PROBES before it
judges, so another process's change is part of the revision a write is checked
against, and a moved base comes back as `StaleWrite` for the ops layer to
re-plan. Safety is not the question. Price is.

### What two stores cost, measured

A synthetic vault the size the human has said olai must serve — **1000 `.md`
documents in a `Daily/YYYY/MM/` shape plus 20 outlines of 100 nodes each**,
1020 files, 600 KB — with the nix-built binary:

| | `olai web` | `olai mcp`, same directory | together |
| --- | --- | --- | --- |
| RSS | 209 MB | 209 MB | **418 MB** |
| open fds | 1050 | 1049 | **2099** |
| probe + validate, per revision | ~9 ms | ~9 ms | done twice, on two clocks |

The fd number is the one that surprises, and it is not the bridge's fault — it
is worth stating separately because the bridge is what would halve it:

> **The recursive watcher holds one open file descriptor per served file, for
> the process's lifetime.** Isolated: a store over this corpus with
> `watch: false` holds 14 fds; the same store with `watch: true` holds 1050.

So a store's fd cost is O(corpus), and a second store doubles it. At 1020 files
that is 2099 descriptors, which nothing on a modern Linux notices. At the tens
of thousands of files a real vault reaches it is the number that meets `ulimit
-n` first, and it meets it twice as fast with two stores. **This deserves its
own roadmap item and is not scoped here** — it is `@olai/store`'s watcher and
the effect/platform `fs.watch(root, { recursive: true })` under it, not
anything about MCP.

The per-revision work is the quieter cost: each store re-reads and re-validates
the whole set on every trigger and on its own 60-second backstop, so a
directory being edited pays for two parses of everything, on two unsynchronized
clocks. Which brings the one correctness-shaped consequence: **the two stores
are at different revisions between probes.** An agent reading a node through
`olai mcp` and a person looking at the same row in the browser can be seconds
apart, and there is no revision either could compare to notice. Nothing breaks
— the write gate handles it — but "the same live rows the browser draws", which
is what this roadmap node promises, is today true only up to that skew.

### What the bridge needs, verb by verb

The machinery is all upstream and all present at the pin. `serveOverUnixSocket`
serves a surface's `{ group, handlers }` over an owner-only socket with
filesystem permissions AS the auth — no token, no port, no origin gate — and
`unixSocketLink` dials it, with `ECONNREFUSED`/`ENOENT` as the discovery answer
(so `olai mcp` falls through to serve-fresh with no state file and no staleness
logic). `serveSurfaceAsMcp`'s `client` factory already accepts an
`OwnedSurfaceConnection` for exactly this case, disposes what it opens, and
re-dials after a drop. None of that is the blocker.

The blocker is that a bridged process has **no `ops`**, so everything it serves
must be reachable through the surface. Checked against today's face:

| what the MCP face serves | reachable over a bridged surface? |
| --- | --- |
| 5 resources (`outlines`, `documents`, `errors`, `git`, `pending`) | **yes** — cells and collections are what the link carries |
| `search_nodes` | **yes** — `search.nodes` is already a procedure |
| `commit`, `push` | **yes** — `git.commit` / `git.push` are already procedures |
| `list_outlines`, `read_node`, `read_subtree` | **no** — three reads with no procedure, and their answers (`Outline`, `Detail`, `Subtree`) are TypeScript interfaces with no wire schema |
| the 18 write tools | **no** — `edit.apply` is a deliberately narrower keyboard vocabulary, not the ops request vocabulary re-spelled |

A read-only bridge was already considered and rejected in the viewing design,
correctly: an attached session with no write tools is not the product, and a
command whose tool set silently depends on whether a server happens to be
running is worse than two stores.

### The two things standing in the way, and neither is plumbing

**1. Putting the ops vocabulary on the surface makes it BROWSER-callable.**

The write path wants one procedure — `ops.run(Request, writer)`. That looks
nearly free: `Request` is already a `Schema.Union`
(`packages/ops/src/request.ts:620`), and `Ops.run` already has exactly that
signature. Then `bespokeFrom` projects the same 24 named tools over a CLIENT
instead of over a local `Ops`, and the bridged process needs no store at all.

Except that **the websocket face has no allowlist.** `serveSurfaceAsMcp` takes a
default-deny `expose` map; `serveSurfaceApp` takes `handlers` whole
(`@kolu/surface-app`'s `serve.ts:287`), and so does `serveOverUnixSocket`. Every
procedure a surface declares is callable by any browser that clears the origin
gate. So "make the ops request vocabulary reachable to a bridged agent" is
inseparably also "make it reachable to every open tab" — which walks straight
through the 130-line argument at `packages/surface/src/edit.ts:1`, that a
browser sends INTENTS and the placement is the server's, and that the editor's
vocabulary is deliberately not the ops request vocabulary re-spelled.

That is not an argument the plumbing gets to settle.

**2. The write path multiplies the duplication (a) just closed.**

`ops.run` needs `Applied` on the wire, and `Applied` is a TypeScript interface
(`packages/ops/src/request.ts:656`), as are `Outline`, `Detail` and `Subtree`
for the three reads. Declaring each as a schema in `@olai/surface` recreates the
search drift four more times, in shapes far larger than a search hit — nested
children, optional stamps, mirror placements. `agree.ts` would carry them, but a
fence is a consolation prize: the better answer is that the ops layer's ANSWER
shapes become schemas it owns, which the wire spec re-exports the way
`CommitRequest` and `Pending` already are. That is a real piece of work with a
real payoff and it should be its own item.

### The written ask to kolu

Filed here as prose, on this PR, and **not on kolu's tracker** — this PR acts on
no other repository.

> **`serveSurfaceApp` and `serveOverUnixSocket` have no `expose`.**
> `serveSurfaceAsMcp` is default-deny about which members an agent may touch,
> and that asymmetry is what blocks olai. A surface with two faces of different
> trust — a browser on the websocket, an agent on a socket — can only make a
> verb reachable to BOTH or to neither, because the serving side takes
> `handlers` whole. What olai wants is the same `ExposeMap` shape the MCP
> adapter already has, applied per serving face, so a procedure can exist on the
> surface and be reachable over the unix socket while staying unreachable from a
> tab. Without it, adopting the bridge means widening the browser's write
> vocabulary as a side effect of giving an agent one.
>
> Sizing note for whoever picks this up: `resolveExpose` already exists and
> already validates a map against a spec at boot, so this is likely a filter at
> the handler-dispatch seam rather than new machinery.

### Position

**Do not build the bridge in this PR.** Two of the three things it needs are
design rulings, not code: whether the ops request vocabulary becomes surface
vocabulary, and — if it does — whether the browser is allowed to speak it. The
second one cannot be answered safely at all until the upstream ask above lands.
Building the plumbing first would produce a branch whose merge decision is
"should every tab be able to call `ops.run`", asked at the end instead of the
beginning.

**Do state the price plainly**, which is what the measurement above is for. Two
stores is not free: 418 MB and 2099 descriptors on a vault of 1020 files, two
parses of everything per edit, and a live-rows promise that holds only up to the
skew between two probe clocks. The write gate makes it SAFE, and it was always
argued as safe rather than as cheap.

---

## What the node should shrink to

The parent can close as a theme once these exist as children. None of them is
started here.

1. **`ops-answers-as-schemas`** — `Applied`, `Outline`, `Detail`, `Subtree`
   declared as Effect Schema in `@olai/ops`, re-exported by `@olai/surface` the
   way `CommitRequest` and `Pending` already are. Independently worth doing: it
   retires the fence in `search.ts` by removing what it fences, and it is the
   prerequisite for every remaining bridge verb. No upstream dependency.
2. **`per-face-expose` (upstream)** — the ask above. Blocks (3).
3. **`mcp-bridge`** — `olai mcp --attach`: `serveOverUnixSocket` beside the
   listener, `unixSocketLink` in `mcp/serve.ts`, a dial failure falling through
   to serve-fresh. Blocked on (1) and (2), and on the human's ruling about
   `ops.run`.
4. **`watcher-fd-cost`** — one open descriptor per served file, per store, for
   the process's lifetime. Found while measuring (c); nothing to do with MCP.
   The bridge halves it; fixing the watcher fixes it.

Positions (a), (b), (d) and (e) are done and need no child.

---

## Method note

Every "already true" above was checked against master rather than against the
predecessor design's claims, and one of them changed answer: the viewing design
predicted `check-kolu-deps.sh` would need no change and it did not, but the
`search.ts` header's claim about compile errors had gone stale in the opposite
direction — asserted, believed, and false. The experiment that settled it is in
(a) and takes two minutes to repeat. It is worth repeating the next time a
document in this directory says two things cannot drift.
