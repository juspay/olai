# One surface for browser and agents: what is left

Audit of the `surface-mcp` roadmap node, 2026-08-14. The node says its adoption
LARGELY LANDED and that it now holds "the remaining design positions". This
checks that claim against master, closes what turned out to be open, and carries
the reasoning behind the four children the node shrank to — which exist in the
ledger, written through the ops layer, and are listed [at the
end](#what-the-node-shrank-to).

The predecessor is [surface-mcp-viewing.md](./surface-mcp-viewing.md), which
designed and shipped the adoption itself (PR #94). Read that one for the
machinery; this one is only about what the parent still owed.

---

## Reading the receipts

**A `file:line` names THIS BRANCH unless it is marked `(master)`.** The two are
not interchangeable here and the distinction is the whole point of an audit: a
line on this branch is a receipt for the FIX, and an audit's claim about what
was open needs a receipt for the GAP. So every position that says "this was
true before" cites master, at the revision this branch forked from
(`65ba1501`), and every position that says "this is true now" cites here.

Getting that backwards is the failure this document is otherwise about, one
level up — a claim that was true, cited against a file that no longer showed
why. Both reviewers caught it on the first pass; the numbers below are the
corrected ones.

---

## The table

| # | position | verdict | the gap, on master | closed at, here |
| --- | --- | --- | --- | --- |
| a | the same verbs exist twice, two schemas free to drift | **CLOSED HERE** — one real instance, and it was live | `ops/src/tools.ts:136` + `ops/src/query.ts:293` + `surface/src/search.ts:29,51` — three spellings of the question, two of the answer, and `surface/src/search.ts:14` claiming they could not drift | `format/src/searching.ts:49,111` — one declaration, on the floor both stand on |
| b | the refusal contract is verified — `isError` + `structuredContent` carrying `OpFailure` | **CLOSED HERE** — one kind of four was pinned, on one face of two | `server/src/mcp/tools.test.ts:452` (the one kind), `mcp/route.test.ts:159` (a success-path `structuredContent` assertion, and no refusal one anywhere in the file) | `mcp/tools.test.ts:506,564`, `mcp/route.test.ts:180` |
| c | the bridge shape exists — an agent attaching to a RUNNING olai's store | **DEFERRED, with a price and one upstream ask** — *built since, see below* | — | unchanged; the argument for the second store is `server/src/mcp/serve.ts:10` |
| d | agents watch live rows, not only call tools | **ALREADY TRUE** — five subscribable resources | — | unchanged: `server/src/mcp/expose.ts:119`, `mcp/face.test.ts:232` |
| e | `check-kolu-deps.sh` covers the package | **ALREADY TRUE** — by construction, and it always was | — | unchanged: `nix/kolu.nix:27` |

Paths are workspace-relative under `packages/` except `nix/kolu.nix`.

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
was spelled three times — the tool's own `SearchArgs` (master,
`ops/src/tools.ts:136`), `Query.search`'s inline parameter type (master,
`ops/src/query.ts:293`), and the wire spec's `SearchRequest` (master,
`surface/src/search.ts:51`). The ANSWER was spelled twice —
`Query.Search`/`Query.Found` as TypeScript, `SearchAnswer`/`SearchHit` as
Effect Schema (master, `surface/src/search.ts:29,44`).

`@olai/surface`'s own header claimed this could not drift (master,
`surface/src/search.ts:14`): *"the procedure's implementation returns
`Query.search`'s value where this schema's type is demanded, so a field added to
one side is a compile error on the other."* That claim was false, and the check
is one experiment:

> Add `readonly drifted: string` to `Query.Found` and produce it in `foundOf`.
> `just typecheck` passes on **all twelve packages.**

What happens next is the part that matters. `search_nodes` hands an agent the
ops layer's value verbatim as `structuredContent`, so the agent sees `drifted`.
The palette's procedure encodes that same value through `SearchAnswer`, which
has never heard of the field, so it is dropped. An agent and a person, searching
the same words in the same directory, looking at different rows — arriving
through the one seam nobody was watching, and silently.

**Closed — and the first attempt at closing it is worth recording, because it
was the wrong altitude.**

The obvious reading is that the two spellings are a structural necessity:
`@olai/surface` may not import `@olai/ops` (a store has no business in a browser
bundle) and `@olai/ops` may not import `@olai/surface` — its manifest says so
outright, "an op does not know it is being called over a wire". On that reading
the pair cannot be merged, only CHECKED, so the first fix was a type-identity
assertion in `@olai/server`, the one package that sees both spellings.

That fix worked and was still wrong, because it answers a question the codebase
had already answered. Both packages stand on `@olai/format`, and that package
has a module whose whole purpose is this case —
`packages/format/src/committing.ts`, whose header reads:

> this package is the floor both the ops layer and the wire spec stand on, and a
> vocabulary spelled in either of those would have to be spelled again in the
> other. The ops layer PRODUCES these values, the surface CARRIES them, the
> browser DRAWS them, and none of the three has to agree with the others by
> memory.

That is the search case word for word. So:

- **one declaration**, `packages/format/src/searching.ts` — `SearchRequest`,
  `Found`, `SearchHit`, `SearchAnswer`, and the default limit the request's
  agent-facing prose quotes. `@olai/ops` imports it and re-exports it under the
  names its own answers use; `@olai/surface`'s `search.ts` is now a re-export
  and nothing else;
- **the matcher does not move.** Which nodes match, how hits are ordered, and
  what `matched` says stay in `@olai/ops`. The shape is the floor's; the ranking
  is the ops layer's — the same division `committing.ts` keeps between the
  shape of a pending commit and the survey that produces one;
- **the fence is gone**, along with the module that held it and the module that
  held its two type aliases. Nothing is asserted because there is nothing left
  to assert.

That last point is the difference worth having. A fence DETECTS the drift; one
declaration makes it **unrepresentable** — verified by repeating the experiment
against the new shape: adding a field to `Found` now fails in `@olai/ops`'
producer and in `@olai/web`'s consumers at once, because there is no longer a
face that could be changed on its own.

### The property, exercised on somebody else's work

Written down because it stopped being an argument the day after it was made.
`filter-in-place` (#168) landed while this PR was in review and extended search
with four fields — `file` and `under` on the request, an optional `matched`, and
a `refusals` list on the answer — plus a `SearchRefusal` re-declaring what
`filter.ts` already produced as `Refusal`. Branching from before this PR, it had
no choice: it edited all four spellings, which is exactly the labour the single
declaration removes.

Resolving that conflict meant seating every one of those extensions onto
`searching.ts`, and then the property could be tested on fields nobody wrote to
prove a point with:

| experiment | what fails |
| --- | --- |
| drop `under` from `SearchRequest` | `@olai/ops`' matcher call and its tests, and `@olai/server` |
| drop `refusals` from `SearchAnswer` | `@olai/ops` (produces them), `@olai/web`'s `search/nodes.ts:140` (draws them), and `@olai/server` — all at once |

The second is the whole argument. Under the arrangement #168 branched from,
`refusals` was declared twice; removing it from one side left the other
compiling, and the field would have half-landed in silence. There is now no side
to remove it from.

It also settled a question the original close left open by luck rather than by
design: #168 made `matched` optional on BOTH spellings, correctly, by hand. That
it got it right is a credit to whoever wrote it and not a property of the code —
which is the difference between a codebase that is careful and one that is
correct.

---

## (b) The refusal contract: pinned for one kind, on one face

The contract is `packages/server/src/mcp/tools.ts:161`: a refused write comes
back as a successful call carrying `isError`, with `kindOf(failure)` and the
raiser's own `toJSON()` as `structuredContent`. That is what juspay/kolu#2155
was filed for, and it is correct.

What fenced it was `not-found`, over an `InMemoryTransport` (master,
`tools.test.ts:452`), plus two `usage` cases that arrived incidentally with
other subjects (master, `tools.test.ts:735,780` — they are at `:858,903` here,
moved by the insertions below and not otherwise touched). Two gaps.

**The kind whose payload IS the point was not pinned.** Three of the four kinds
carry a sentence and at most an id. `validation` carries the validator's own
rows — `file`, `line`, `code`, `message` per finding — and that is the entire
argument for structured refusals: an agent fixes the one line that is wrong
instead of re-reading a directory it cannot parse. It is also the only kind
whose detail is an array of objects, hence the only one the schema bridge could
plausibly flatten on the way out.

Pinned now (`tools.test.ts:564`) over a set-wide break, on a READ and on a
WRITE — because the point of the kind is that a refused write and a broken file
on disk are explained by ONE report (`packages/format/src/failure.ts:58`) — and
the same rows are asserted to arrive on `surface://cells/errors`. That last
assertion is this roadmap node's own thesis at the one place it would actually
be felt: **an agent and a person looking at a broken directory are looking at
one report, in one vocabulary, at one instant.**

**And the transport olai wrote itself had no refusal test.** `mcp/route.ts` is
a half-duplex HTTP shape with a waiter table, built because neither of the SDK's
Streamable modes fits, and it is the pipe the chat panel's agent reads its
refusals through. It had a success-path `structuredContent` assertion (master,
`route.test.ts:159`) and no refusal one anywhere in the file — leaving three
failure modes an in-memory pair cannot have: an HTTP status keyed off `isError`,
a JSON-RPC `error` frame instead of a result, or the structured half lost in the
reply's serialization. Pinned here (`route.test.ts:180`).

**And the four kinds now DRIVE the tests** rather than being pinned by
scattered assertions. `tools.test.ts:506` keys a table off `@olai/format`'s own
`FailureKind`, and the only two things that satisfy a key are the call that
provokes the kind or a written sentence saying why nothing here can. A fifth
kind is a missing key, named by the compiler.

The first version of this was a list of the four WORDS, checked identical to the
format's union — and a list of words is satisfied by typing the fifth word in.
It demanded a name where what was wanted was a test. `busy` is the one signed
exemption: its only raiser is the write loop giving up after `ROUNDS` re-plans,
each overtaken by another writer, which a test could only produce by standing up
a store that rewrites itself continuously — a test of the retry rather than of
this contract. That sentence is in the code, beside the key it excuses.

Scope note: the compile-time closure is over `tools.test.ts`'s table. The HTTP
route's refusal test is deliberately an ENVELOPE test and pins `not-found`
only — a second table there would be a second answer to "which kinds exist".

---

## (c) The bridge: what it would cost to have, and what it costs not to have

> **Since built.** Both things this position said were rulings rather than code
> have been made: kolu gave every serving face its own `expose`
> ([juspay/kolu#2170](https://github.com/juspay/kolu/pull/2170), the ask below,
> ratified and merged), and the ops vocabulary went onto the surface with the
> browser denied it. `olai mcp` attaches. This section is left as it was
> WRITTEN — an audit is a record of what was known when — and what the price
> turned out to be, re-measured on both sides with this same method, is
> [mcp-bridge.md](./mcp-bridge.md). One number in it corrects a reading here:
> the memory did not halve, because it was never mostly the corpus.

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
| RSS (`VmRSS`) | 209 MB | 209 MB | **418 MB** |
| open fds | 1050 | 1049 | **2099** |
| probe + validate, per revision | 8–11 ms | 8–11 ms | done twice, on two clocks |

Method — samplers, corpus generator and the isolated watcher probe — is written
out below, under [How it was measured](#how-it-was-measured).

The fd number is the one that surprises, and it is not the bridge's fault — it
is worth stating separately because the bridge is what would halve it:

> **The recursive watcher holds one open file descriptor per served file, for
> the process's lifetime.** Isolated: a store over this corpus with
> `watch: false` holds 14 fds; the same store with `watch: true` holds 1050.

So a store's fd cost is O(corpus), and a second store doubles it. At 1020 files
that is 2099 descriptors, which nothing on a modern Linux notices. At the tens
of thousands of files a real vault reaches it is the number that meets `ulimit
-n` first, and it meets it twice as fast with two stores. **This has its own
roadmap item (`watcher-fd-cost`) and is not scoped here** — it is
`@olai/store`'s watcher and the effect/platform `fs.watch(root, { recursive:
true })` under it, not anything about MCP.

The per-revision work is the quieter cost: each store re-reads and re-validates
the whole set on every trigger and on its own 60-second backstop, so a
directory being edited pays for two parses of everything, on two unsynchronized
clocks. Which brings the one correctness-shaped consequence: **the two stores
are at different revisions between probes.** An agent reading a node through
`olai mcp` and a person looking at the same row in the browser can be seconds
apart, and there is no revision either could compare to notice. Nothing breaks
— the write gate handles it — but "the same live rows the browser draws", which
is what this roadmap node promises, is today true only up to that skew.

### How it was measured

Written out because `watcher-fd-cost` will want to re-measure the same way, and
because a number without its sampler is an anecdote. Linux, `x86_64`, nix-built
binary (`nix build .#olai`), `ulimit -n` 524288.

**The corpus** — 1000 `.md` in a daily-note shape plus 20 outlines of 100 nodes,
1020 files, 599568 bytes:

```sh
mkdir -p corpus && cd corpus
for i in $(seq 1 1000); do
  d=$(printf "Daily/2026/%02d" $((i % 12 + 1))); mkdir -p "$d"
  printf '# note %d\n\nSome body text for note %d.\n%s\n' "$i" "$i" \
    "$(head -c 400 /dev/zero | tr '\0' 'x')" > "$d/note-$i.md"
done
for f in $(seq 1 20); do
  { echo "{\"id\":\"root-$f\",\"ord\":\"a0\",\"title\":\"Outline $f\"}"
    for n in $(seq 1 100); do
      printf '{"id":"n-%d-%d","parent":"root-%d","ord":"a%d","title":"node %d of outline %d"}\n' \
        "$f" "$n" "$f" "$n" "$n" "$f"
    done
  } > "outline-$f.jsonl"
done
```

**The two processes**, on that one directory, with the agent off so the numbers
are the store and the surface and nothing else:

```sh
OLAI_ACP_AGENT= olai web corpus --port 7788 --host 127.0.0.1 &   # WEB=$!
OLAI_ACP_AGENT= olai mcp corpus < a-fifo-held-open &             # MCP=$!
```

`olai mcp` needs its stdin held open or it drains and exits — a fifo carrying
one `initialize` frame, with the writer sleeping, is enough.

**The samplers**, both `/proc`, never `ps` (which reports its own rounding):

```sh
grep VmRSS /proc/$PID/status      # RSS
ls /proc/$PID/fd | wc -l          # open descriptors
ls -l /proc/$PID/fd | grep -c corpus   # how many of them are served files
```

Sampled ~6 s after each process logs `serving` / `serving the outline surface
over stdio`, then re-sampled after the run and found unchanged — which is the
point about the descriptors: they are held, not transient. 1035 of the web
process's 1050 resolved to files under `corpus`.

**The isolated watcher finding** — the load-bearing one, and the cheapest to
repeat. A store and nothing else, the same corpus, the flag flipped:

```ts
// run under the dev shell, from inside the workspace so @olai/* resolves
import { NodeServices } from "@effect/platform-node"
import { codec } from "@olai/ops"
import * as Store from "@olai/store"
import { Effect } from "effect"
import * as fs from "node:fs"

const fds = () => fs.readdirSync(`/proc/${process.pid}/fd`).length
await Effect.gen(function*() {
  console.log(`before: fds=${fds()}`)
  yield* Store.make({ root: process.argv[2]!, codec, watch: process.argv[3] === "watch", settle: "10 millis" })
  yield* Effect.sleep("3 seconds")
  console.log(`watch=${process.argv[3] === "watch"}: fds=${fds()}`)
}).pipe(Effect.scoped, Effect.provide(NodeServices.layer), Effect.runPromise)
```

`before: fds=14` both times; `watch=false: fds=14`, `watch=true: fds=1050`.

**The per-probe timing** is `store.refresh` — "probe NOW, and do not return until
the result has been published" — timed with `performance.now()` around five
consecutive calls after the first snapshot, on a `watch: false` store so the
watcher cannot fire one of its own: `11, 10, 8, 10, 8` ms. That is the read +
parse + validate of the whole set that each store repeats on its own clock; it
is not a claim about steady-state CPU.

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
children, optional stamps, mirror placements.

The route through that is now paved rather than hypothetical: it is what (a)
did, and `packages/format/src/searching.ts` is the worked example beside
`committing.ts`. **Three things about it have to be said out loud, because all
three are traps.**

*Where they go is `@olai/format`, not `@olai/ops`.* The obvious phrasing —
"declare them in the producing package and re-export from `@olai/surface`" — is
wrong, and wrong in the load-bearing part: it makes `@olai/surface` depend on
`@olai/ops`, which is the ban that made the duplication structural in the first
place (`packages/ops/package.json`: "`@olai/surface` is deliberately absent").
`CommitRequest` and `Pending` are not re-exported from their producer; they live
on the FLOOR. So does search now.

*And `Applied` is not one of them.* `@olai/surface`'s `Applied`
(`packages/surface/src/edit.ts:705`) is a genuinely DIFFERENT type from the ops
layer's: it adds `undo` and drops `summary`, `sort`, `captured` and `rev`. That
narrowing is the editor's design, argued at length, and no shared declaration
can express it — the two are not one thing spelled twice. Whoever picks this up
should expect the item to split there: `Outline`/`Detail`/`Subtree` are one
vocabulary crossing a floor; a keyboard's answer is not.

*And `Outline` is already taken, at the destination's public surface.*
`@olai/format` exports an `Outline` of its own — one file's decoded nodes,
`{ file, nodes: ReadonlyArray<Located> }` (`packages/format/src/set.ts:62`,
re-exported at `index.ts:53`). The ops layer's `Outline`
(`packages/ops/src/query.ts:161`) is the `list_outlines` SUMMARY:
`{ file, nodes: number, roots, unreadable? }`. Two different concepts, one name,
and the collision is the nastier kind — both carry `file` and `nodes`, so the
shapes look compatible at a glance while `nodes` means a node list on one and a
COUNT on the other. Moving the ops one onto the floor under its current name is
not a rename away from a compile error; it is a rename away from a plausible
one. Rename it at the move — `OutlineSummary` says what it is, and says it
against the neighbour it would otherwise shadow.

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

## What the node shrank to

**These are roadmap nodes, not a wishlist.** All four exist under `surface-mcp`
as of 2026-08-14, marked `todo`, written through the ops layer when this audit's
first debrief landed — which is the only door the ledger has, and deliberately
not this branch's. The parent is `doing`.

What follows is the REASONING, which is what a design doc is for and what a
node's `desc` has no room to carry. The ledger says what is open; this says why
each one is a thing rather than a paragraph.

1. **`reads-on-the-floor`** — "Query-shaped reads move to the format floor": the
   `list_outlines` summary, `Detail` and `Subtree` declared as Effect Schema in
   `@olai/format`'s `searching.ts`, beside the search shapes this PR put there
   and for the identical reason. Three traps, all argued under (c): NOT in
   `@olai/ops` (inverts the layer), NOT including `Applied` (deliberately a
   different type on each side), and the summary must be RENAMED on the way —
   `@olai/format` already exports an `Outline`, and it is a different thing
   whose shape looks compatible. The third is grok's catch from the review
   round. Prerequisite for the three read verbs a bridge needs, and worth doing
   on its own terms: they are the last query answers with no wire shape. No
   upstream dependency. Awaits the human's scope ruling with the parent.
2. **`per-face-expose`** — the upstream ask, `#upstream #human`. **Nothing is
   filed on kolu**; the ask is prose on this PR and in (c) above, and it awaits
   the human's ratification before it becomes anyone's issue. It is what the
   write-unification question turns on.
3. **`mcp-bridge`** — `olai mcp --attach`: `serveOverUnixSocket` beside the
   listener, `unixSocketLink` in `mcp/serve.ts`, a dial failure falling through
   to serve-fresh. The machinery is all present at the pin; what blocks it is
   the write-unification question above, and the human's ruling about `ops.run`.
   Priced under (c) rather than shrugged at.
4. **`watcher-fd-cost`** — `#techdebt`, and the one that is not about MCP at
   all: one open descriptor per served file, per store, for the process's
   lifetime. Found while measuring (c). The bridge halves it; fixing the watcher
   fixes it. The method under (c) is written out so this one re-measures the
   same way rather than a new way.

The ledger declares no `after` edges between them, and this document should not
invent any: 2 gating 3 is an argument made here, not an ordering anybody has
committed to. 1 and 4 are genuinely independent of both.

Positions (a), (b), (d) and (e) are done and have no child, which is the other
half of what "shrank to" means.

---

## Method note

Every "already true" above was checked against master rather than against the
predecessor design's claims, and one of them changed answer: the viewing design
predicted `check-kolu-deps.sh` would need no change and it did not, but
`@olai/surface`'s `search.ts` header claimed a compile error that did not
exist — asserted, believed, and false. The experiment that settled it is in (a)
and takes two minutes to repeat. It is worth repeating the next time a document
in this directory says two things cannot drift.

The second lesson is about the fix rather than the finding. The first close was
a type-identity fence, and it was a good fence: it fired, it named itself, and
it was wrong, because this codebase had already answered the question one floor
down and the fence was a second answer to it. What surfaced that was a reuse
pass over the branch's own diff, which found `committing.ts` — a module written
for exactly this case, whose header is the argument I had just re-derived.
**Before building a mechanism to check that two things agree, look for the place
they could have been one thing.** Both fences on this branch fell to that: the
refusal-kinds one became a `Record` keyed by the format's own union, which needs
no assertion at all.

The third is the one the review round taught, and it is this section's own
subject read back at it. Two receipts for the pre-PR state cited lines on THIS
branch — where the fix is — rather than on master, where the gap was. The claims
were true and both reviewers verified them independently; the receipts still
pointed at the wrong file, which in an audit is the whole of what a receipt is
for. A document whose method is "checked against master" has to say which
revision each number is from, so [the convention is now
stated](#reading-the-receipts) and the pre-PR numbers are master's.

A number needs its sampler for the same reason a claim needs its revision.
Both reviewers also landed on the measurements under (c): corpus shape and
results were given, the commands were not, so the price of two stores was
reproducible in design and not in practice. That is now written out — generator,
samplers, the isolated watcher probe — because the child that inherits the fd
finding should re-measure the same way rather than a new way, and because a
document that says "this takes two minutes to repeat" should be right about
which experiments do.
