# `outlines` as a collection, not a stream

Status: BUILT, 2026-08-10 — this is what shipped, not a proposal. Prompted by the surface-utilization audit: the framework ships keyed incremental delivery (`CollectionDeltasMsg`) and olai routed around it, resending the whole corpus on every change. What follows is the design as brainstormed (2026-08-09); the three open questions at the bottom are answered, and the two places the built thing differs from the sketch above are named there. The kolu `writeWrappedValue` fix was NOT bundled with it — that is separate work, and the timing question is answered below.

## Today: one stream, whole corpus per frame

```ts
// packages/surface/src/index.ts — as shipped
streams: {
  outlines: {
    inputSchema: NoInput,
    outputSchema: Schema.NullOr(Schema.Struct({
      rev: Schema.Int,
      set: OutlineSet,          // files + ALL nodes + documents + broken
    })),
  },
}
```

Edit one line of `roadmap.jsonl` → the frame carries **every node of every file**. Delivery is O(corpus); the "fine-grained" part is delegated to client-side `reconcile` — the exact code where live-dead broke, keying on a Solid default the payload never promised.

## Proposed: a collection keyed by file

The per-file unit already exists in format — `Outline` (`packages/format/src/set.ts`: "the codec's per-file unit, which the store caches and re-decodes independently. It is not what the browser receives") — this proposal makes it what the browser receives.

```ts
// packages/surface — proposed
import { BrokenFile, Located, OutlineError } from "@olai/format"

/** One outline file's slice of the set, as published at set revision `rev`.
 *  Exactly one of `nodes` / `broken` is meaningful: a file that stopped
 *  parsing keeps its key and carries its errors — the per-entity degrade of
 *  the error-scope decision, expressed as data instead of by absence. */
export const OutlineEntry = Schema.Struct({
  rev: Schema.Int,                       // set revision; all entries of one tick share it
  nodes: Schema.Array(Located),          // this file's nodes only, in file order
  broken: Schema.NullOr(BrokenFile),
})

export const surface = defineSurface({
  cells: {
    errors:    { schema: Schema.Array(OutlineError), default: [], verbs: ["get"] },
    /** Set-wide facts that belong to no one file. `documents` moves here too. */
    manifest:  { schema: Schema.NullOr(Schema.Struct({
                   rev: Schema.Int,
                   documents: Schema.Array(Schema.String),  // BUILT AS: Array(Document) — see below
                 })), default: null, verbs: ["get"] },
  },
  collections: {
    outlines: {
      keySchema: Schema.String,          // root-relative path: "roadmap.jsonl"
      schema: OutlineEntry,              // (the framework's own spelling for the value)
      verbs: ["keys", "get", "deltas"],  // read-only on the wire; no upsert/delete served
    },
  },
})
```

The key is **declared in the protocol** — `keySchema` — not inherited from a client-library default. That is the type-level fix to the live-dead disease, applied at the layer where it belongs.

## What actually crosses the wire

Corpus: `docs/` — `roadmap.jsonl` (17 KB), plus brainstorming `.md`s. Subscriber opens (or reconnects):

```jsonc
{ "kind": "snapshot",
  "entries": [
    ["roadmap.jsonl", { "rev": 41, "nodes": [ /* 22 Located */ ], "broken": null }]
  ] }
```

**Edit one line of `roadmap.jsonl`** — the probe re-decodes that one file, the producer tick publishes one coalesced frame:

```jsonc
{ "kind": "delta",
  "upserts": [["roadmap.jsonl", { "rev": 42, "nodes": [ /* 22 Located */ ], "broken": null }]],
  "removes": [] }
```

One file's slice — today that is the whole corpus only because the corpus IS one file; with fifty outlines it stays one file while the stream design sends all fifty.

**`git pull` touches three files, deletes one** — the store's one-probe-per-burst becomes one tick, so ONE frame:

```jsonc
{ "kind": "delta",
  "upserts": [["a.jsonl", {…rev 43…}], ["b.jsonl", {…rev 43…}], ["c.jsonl", {…rev 43…}]],
  "removes": ["dropped.jsonl"] }
```

**A file stops parsing** (per-entity degrade, as shipped in the live PR — but now it is an upsert, not a shape change of the whole snapshot):

```jsonc
{ "kind": "delta",
  "upserts": [["notes.jsonl", { "rev": 44, "nodes": [], "broken": { "file": "notes.jsonl", "errors": [ /* file:line */ ] } }]],
  "removes": [] }
```

Whole-set validation failure is unchanged: entries hold last-good, the `errors` cell publishes — the two-channel design survives intact.

## Where the upserts come from — the store already knows

The probe's stamp diff IS the upsert list: `stale` (changed/new files) → upserts, the size-check deletions → removes. Today that knowledge is collapsed into one whole-set value and thrown away; the server-side diff to feed `deltas` is a projection of information `packages/store` already computes per probe. Options: the store exposes a per-probe change summary alongside the snapshot (small API addition, still generic), or the server diffs consecutive snapshots by file (no store change, O(files) compare per tick).

## Wire deltas vs the edit revision — what's shared, what isn't

Both name "a change against a base", and that is where the likeness ends.

- The **commit's `baseRev`** (phase-4 OCC) is an explicit, *checked* precondition: two writers race across time with nothing ordering them, so the write must name the disk state it was derived from and the store must refuse if the disk has moved.
- The **wire delta needs no base revision at all**, because its base is supplied by the channel: one subscription, one ordered lossless socket, and the framework's contract is snapshot-then-deltas *per subscription*. A delta is only ever interpreted against the previous frame of the same connection — which the transport guarantees arrived, in order. There is no resume protocol and none is being added: a reconnect never says "I have rev 41, diff me forward"; it re-subscribes and gets `{kind:"snapshot"}`, exactly today's fresh-read semantics.

So `rev` still travels in the entry — for display, for proving two frames differ, and as the `baseRev` a phase-4 write will name — but the delta transport itself never consumes it.

## Who maintains the delta, and is it reliable

Three layers, two owners:

- **Transport and merge: the framework's.** The server-side `deltasBus` coalesces a producer tick into one `{upserts, removes}` frame (bus payload and wire frame are one type, "so they can't drift"); the client merge is a keyed Map operation — upsert key K, remove key K — with K declared in `keySchema`. No heuristic diffing anywhere: unlike Solid's `reconcile`, there is nothing to guess, which is why this path is immune to the live-dead class.
- **Reliability**: within a live socket, TCP ordering makes snapshot ⊕ deltas exact; any break in the socket re-enters through a fresh snapshot. Client state cannot silently drift — the only way to be wrong is a merge bug, and the merge is a Map write.
- **The change list: the producer's — and its natural home is the store.** The framework has to be *told* which keys changed this tick. The probe already computes exactly that list (the `stale` files it re-decoded, plus the deletions its size-check caught) and today throws it away after validating. Exposing a per-publish change summary (`{changed: paths, removed: paths}`) keeps the diffing encapsulated in `packages/store` — still generic, it is path talk, not content talk — and the server's job stays a thin projection: map changed paths to `OutlineEntry` upserts. The alternative (server diffs consecutive snapshots by file) needs no store change but re-derives what the store knew.

## What this buys / costs

- **Wire O(changed files), not O(corpus)** — and one coalesced frame per tick either way, which also pushes the frame-cap horizon out by ~a corpus/file ratio.
- **Keying becomes protocol** (`keySchema`), not a Solid default — the live-dead class cannot recur at this layer. (Within one entry, `nodes` is still an array a client store must merge; entries are small.)
- **Reconnect stays a fresh snapshot** — `{kind:"snapshot"}` on (re)subscribe is the framework's own contract; nothing to resume, same as today.
- **Atomicity**: entries changed in one tick share one `rev` in one frame, so a consumer never renders half a probe. Cross-file consistency for readers of *unchanged* files relies on unchanged entries still being at their old rev — a mirror rendering B's subtree from A must tolerate A@42/B@41 for a frame; today's all-at-once snapshot hides this. Worth one deliberate paragraph in the spec when built.
- **Migration, not ongoing cost**: the client data-access layer is rewritten once — stream hook → collection hooks, the derive memo and sidebar re-derive from entries/`keys`, tests follow — and the set-wide facts need their second home (`manifest`). After that the ongoing model is arguably *simpler*: per-entry stores instead of one corpus-sized value. The earlier draft called this a "cost"; it is a one-time diff.

## Cross-file consistency: what a consumer must tolerate

The deliberate paragraph the bullet above asked for, now that it is built.

Entries changed in one tick share one `rev` and arrive in one frame, so nobody
renders half a probe. What is NOT true — and was, while the whole set travelled
as one value — is that everything on screen is at the same revision. Only the
files that moved are upserted, so a reader that mirrors B's subtree into A's
page can be holding **A@42 beside B@41** for a frame, and after a tick that
touched neither, indefinitely. The `manifest` is a member of its own and arrives
on its own schedule — in fact usually FIRST, because a cell publishes on the
writer's stack while the collection's frame is coalesced onto a microtask. All
of that is the price of the wire being O(changed files), and it is paid on
purpose.

What the wire says and what a fresh subscriber READS are held to the same
number, though, and that one is not negotiable: an unchanged file keeps the
entry it was published with rather than being rebuilt at the new revision, so
the snapshot a tab opened just now gets cannot name a revision no delta ever
announced. Two tabs watching one directory hold the same `rev` for the same
file. (`packages/server/src/outlines.ts`, and the test that pins it.)

The rule that makes it safe is that **nothing reads `rev` to decide what to
draw**. Every view is derived from what the entries currently SAY — the
derivation, the sidebar, which files are broken, what a mirror resolves to —
and a stale-by-one-tick neighbour is exactly the file as it is on disk, because
nothing moved it. `rev` is for display, for proving two frames differ, and as
the `baseRev` a phase-4 write will name; a consumer that started branching on
it would be the one to break this, and would have to say why.

One skew is a reader's to notice: the `manifest` decides between "waiting",
"never loaded" and "reading", so a manifest that lands before the collection's
first snapshot shows an empty directory for a frame. Both are seeded on
subscribe over one ordered socket, so the window is a paint at most, and the
alternative — a second copy of the file list on the manifest, so the two could
be compared — is a duplication that would have to be kept in step for a
sub-frame flash. Not taken.

## The open questions, answered

- **`manifest` cell vs folding `documents`/set-rev elsewhere.** The cell for the
  documents, as leaned; NOT for the set rev. It is also where the boot bit lives
  (below). Two DEVIATIONS from the sketch, and they are connected:

  `documents` carries `Document` records — text and all — not `Array(String)`. A
  path-only list would need a second read path for a document's text, and there
  is not one: markdown is interpreted at view time and a `doc` reference is
  drawn wherever its node is.

  Which is why the set rev is NOT here. Carried beside that payload it would
  have made the cell's value differ on every probe tick — every document's text
  to every open tab because one line of one outline moved, which is the very
  thing this re-modelling is against. Nothing reads it (a revision belongs to a
  file, and every entry carries the one it was published at, which is the number
  a phase-4 write will name), so it is gone and the cell declares an `equals`
  instead: a tick that touched no `.md` publishes nothing at all. What remains
  is granularity rather than frequency — one edited document sends the list —
  and documents as a collection of their own is the next step, deliberately not
  bundled in.
- **Store summary vs server diffing snapshots.** The store, as leaned:
  `Snapshot` grew `changed` / `removed`, which is the probe's stamp diff kept
  instead of thrown away, and the server maps changed paths to `OutlineEntry`
  upserts (`packages/server/src/outlines.ts`). One thing the sketch did not
  see: the summary has to span the gap between two PUBLISHED revisions, not one
  probe. A probe whose set the codec refuses publishes nothing, and the files it
  re-decoded are still what changed when a later probe validates — so it
  accumulates until a revision carries it out, and a path lands in exactly one
  of the two lists (edited-then-deleted is a remove).
- **Null-vs-empty at boot.** The `manifest`'s `null` carries it, as leaned: no
  frame yet is "waiting", `null` is "nothing has ever validated", a value is
  "here is your directory" — the same three states the nullable stream frame
  said, in the member that is not the collection.
- **Timing.** Built on its own, without the kolu `writeWrappedValue` fix. The
  two touch the same client layer but not the same question, and the client
  rewrite here — stream hook → `outlines.ts`, the derivation and the sidebar
  re-derived from entries and keys — is small enough not to want a second
  subject in it.
