# Surface design — the two upstream vaults of the 2026-08-19 sitting

Design only, no implementation. Signatures are against kolu HEAD
(`packages/surface/src` as of `ac9c80798`) and olai HEAD; file:line citations
are to those trees. The debate's guards are restated inline where they ruled a
shape out.

---

## Finding 1 — the `deltas` frame is the unit of update

**One socket, two faces that ship together.** The fold combinator without the
in-place merge leaves `documents.tsx`'s heads tax standing; the merge without
the combinator leaves `deriving.ts` reconstructing. Neither half is
independently shippable against the debate's guard.

### 1a. The named-key in-place merge (internal, no API change)

`useCollectionDeltas` today routes every frame through
`createSubscription`'s generic reduce (`useCollection.ts:268-276`):
`foldCollectionDeltas` copies the whole `byKey` dict per delta
(`useCollection.ts:219`), returns a fresh accumulator, and
`writeWrappedValue` then `reconcile`s the whole dict to rediscover the keys
the frame already named (`writeValue.ts:65-71`). Two O(N) passes per
O(|frame|) update.

**Redesign:** `useCollectionDeltas` stops delegating to the reduce path. It
owns its store directly and drives the wire stream on its own scoped fiber
(`runStreamScoped`, the same construction `createSubscription` uses — the
Effect↔Solid edge stays the one sanctioned `runFork` boundary). Per frame:

- **`delta` frame** — for each upsert, `assertFoldableKey(k)` then one
  named-key store write at `byKey[String(k)]`, replacing that leaf; for each
  remove, delete that leaf. `order` handled exactly as today
  (by-reference when membership is unchanged, `assertKeysInjective` when a
  new key enters — `useCollection.ts:236-250` survives verbatim as logic).
  Cost: O(|frame|) writes, **no dict copy, no N-key walk**. Only the named
  keys' readers re-notify.
- **`snapshot` frame** (first frame, and every retry-fence reconnect) — one
  whole-set application, O(N), which is inherent (the frame carries N
  entries). Constraint carried over from today's behavior: an entry whose
  value is unchanged since the last-seen state must **not** re-notify its
  readers — the retry fence deliberately turns a transport drop into a
  snapshot that is visually a no-op (`createSubscription.ts:15-18`), and the
  in-place merge must preserve that (value-diff on the snapshot arm only).

Aliasing contract (stated because folds below receive the same frame
objects): the store applies deltas by **leaf replacement**, never by mutating
an object it previously adopted — the same "replaced rather than recycled"
law `writeValue.ts` pins for arrays. A frame object handed onward is frozen
from the store's point of view.

The public `{ keys, byKey }` contract is untouched: `byKey(k)` still returns
a `Subscription<T>`-shaped accessor with the batched stream's shared
`error`/`pending`/`complete` (`useCollection.ts:281-302`), absent keys still
read `undefined`, `keys()` is still arrival-order, `"__proto__"` is still
reserved, the homogeneous-primitive-key constraint still crashes loudly.
Health enrolment is unchanged in effect: the hook mints one
`Subscription`-shaped handle (its `error`/`pending`/`complete` signals) for
`enroll` — the hand-assembled shape `createSubscription.ts:90-95` already
sanctions.

`foldCollectionDeltas` (the exported copying fold) has no consumer outside
its own test file — no kolu app, no olai, no drishti reach it. It is deleted
with its describe-block, and `collectionDeltas.test.ts`'s client-fold cases
re-target the store-applying merge. Keeping it exported "for raw consumers"
would preserve exactly the rejected shape.

### 1b. The fold combinator (the new face)

**Types** — in `packages/surface/src/solid/useCollection.ts`, reusing
`define.ts`'s wire types (no new frame vocabulary is minted;
`CollectionDelta<K, T>` is already the one type the bus and the wire share,
`define.ts:159-162`):

```ts
import type { CollectionDelta } from "../define";

/** Fold a `deltas` collection's frames into a consumer-owned accumulator.
 *  The frame is the unit of update: `step` receives the wire's own
 *  `{upserts, removes}`, unchanged. */
export interface CollectionFoldOptions<K, T, A> {
  /** Answer for a full-set frame: the wire's first frame, every reconnect
   *  snapshot, and the synthetic snapshot a fold registered mid-stream is
   *  seeded with. Entries are in arrival order. */
  init: (entries: ReadonlyArray<readonly [K, T]>) => A;
  /** Answer for one coalesced delta frame. MUST be total over removes of
   *  keys it has never seen (see semantics). */
  step: (acc: A, delta: CollectionDelta<K, T>) => A;
}

export type CollectionFold<K, T> = <A>(
  options: CollectionFoldOptions<K, T, A>,
) => Accessor<A | undefined>;

/** `useCollectionDeltas`'s result: the per-key view plus the frame socket. */
export interface UseCollectionDeltasResult<K, T>
  extends UseCollectionResult<K, T> {
  fold: CollectionFold<K, T>;
}
```

**Attach points:**

- `useCollectionDeltas` returns `UseCollectionDeltasResult<K, T>` (widened
  from `UseCollectionResult`).
- The bound face (`surfaceClient.ts`): for a collection whose `verbs`
  declare `deltas`, `.use()` returns
  `BoundCollectionResult<K, T> & { fold: CollectionFold<K, T> }` (and the
  read-only variant likewise). The gate is the same structural one that
  already conditions `unenrolledDeltas` on the `deltas` verb
  (`surfaceClient.ts:281-291`): a collection without `deltas` has no frames,
  so `fold` is **unspellable** there, not a runtime `undefined`. The per-key
  `useCollection` path gets no fold — it has no frames to hand over.

**Semantics:**

- *Ordering per wire frame:* assert keys → apply to the store (1a) → notify
  registered folds → clear `pending` if set. Folds run after the store
  write, so a `step` that reads `byKey` (discouraged, but expressible) sees
  state consistent with the frame it holds. All within one synchronous frame
  handling — Solid batching makes store readers and fold readers observe the
  same tick.
- *Snapshot boundary:* a wire `snapshot` frame **re-initializes** every
  registered fold — `acc = init(entries)` — after the store applies it. The
  consumer never distinguishes first-connect from reconnect; both are
  "here is the whole set."
- *Mid-stream registration:* `fold()` called when the slot already holds a
  snapshot is seeded **synchronously** with a synthetic snapshot built from
  the current store (`order` × `byKey`) — so arriving late is
  indistinguishable from a reconnect, and the accessor never reads
  `undefined` after registration in that case. Registered while `pending()`,
  the accessor reads `undefined` until the real snapshot lands.
- *Removes of unknown keys:* the tick coalescer resolves upsert-then-remove
  to a bare remove (`server.ts:695-698`), so a key born and dead inside one
  producer tick reaches the wire as a remove **never preceded by an
  upsert**. The store already treats this as a no-op
  (`useCollection.ts:224`); the fold contract makes it the consumer's law
  too: `step` must be total over such removes. The frame is delivered
  verbatim — the framework does not filter it, because filtering would be
  the framework re-swallowing part of the frame.
- *Errors:* the batched stream's error is collection-wide and terminal
  (retry-fence exhaustion or a declared failure). Fold accessors keep their
  last value, frozen — exactly `byKey`'s behavior; the error surfaces
  through the existing shared `error()` / `onError` / health enrolment.
  Nothing new. A **throwing `step`/`init`** is guarded per-fold and reported
  loudly (`console.error`), never allowed to kill the stream or the other
  folds — the same containment `createUpdatedTracker` applies to `updated`
  handlers (`createSubscription.ts:327-333`), for the same shared-slot
  reason.
- *Teardown:* `fold()` must be called under a reactive owner; its
  registration is dropped by `onCleanup` on that owner. Called ownerless it
  **throws** (a fold with no owner would accumulate forever; the net-zero
  `runUnderOwner` trick used for `onError` would produce an instantly-dead
  fold, which is worse than a crash). The shared slot's own lifetime is
  untouched: last consumer out interrupts the fiber, finalizers cancel
  upstream. On typed end (`complete`), fold accessors freeze with the rest
  of the evicted slot's view — parity with `byKey`.
- *Aliasing:* `step` receives the wire's decoded frame objects, which the
  store also adopts by replacement (1a) — neither side ever mutates them, so
  a fold may retain them (olai's patcher does) without cloning.

### 1c. olai after

`deriving.ts` (153 lines + its test + the bench's fold arm) is **deleted
whole** — nothing remains of it. `View` and its `revs` map existed only to
rediscover the frame; the fold accumulator is `Derived` alone. The policy
was never in it: `@olai/format`'s `patch` already takes `SetDelta =
{upserts, removes}` — its own docstring says it is "Surface's
collection-delta frame" (`patch.ts:86-102`) — and `OutlineEntry` satisfies
its structural upsert shape by carrying `nodes`. `outlines.ts:89-93`
becomes:

```ts
const view = entries.fold({
  // A snapshot has nothing standing to patch onto; the patcher declines and
  // rebuilds — the same first-frame arm deriving.ts documented.
  init: (all) => patch(EMPTY, { upserts: all, removes: [] }),
  step: (held, { upserts, removes }) => patch(held, { upserts, removes }),
})
// derived: () => manifest gate ∘ view(), as today
```

Checked against `patch`'s real code: removes-first, `byFile.delete` on an
absent file is a no-op (`patch.ts:264-267`), so the unknown-remove law costs
olai zero guard lines. (One benign wrinkle: such a remove still lands in
`touched`, so a frame containing *only* it produces a fresh `Derived`
identity — one wasted downstream wake on a born-and-died-in-one-tick key.
Rare, harmless, noted.)

`OutlineEntry.rev` **stays on the wire** — it is the change-token contract
(`@olai/surface`'s `index.ts:130-150`) and `Head.rev` is how a page watches
one file without a body. What dies is only its use as a reconstruction
marker. `documents.tsx`'s heads fold changes **no code**: the same `.use()`
call now costs O(|frame|) per revision instead of one pass over the
directory's paths — the "WHAT THE BATCHED VERB COSTS" paragraph
(`documents.tsx:27-37`) is rewritten to say the trade is gone.

---

## Finding 2 — `CollectionHandlerDeps.holders`

### 2a. The type

One optional member on the existing deps record (`server.ts:618-638`):

```ts
export interface CollectionHandlerDeps<K, T> {
  // ...readAll / readOne / upsert / remove / perKeyBus / keysBus / deltasBus...

  /** A reader HOLDS `key` for the lifetime of the scope this runs in — the
   *  per-key `get` stream's own scope. Runs BEFORE the channel subscribe and
   *  BEFORE `readOne` (the pull order is load-bearing: a `readOne` that acts
   *  on the hold — reading a body only a held path is read for — must find
   *  the hold already in place). Fiber interruption is the release: the
   *  scope closes when the tab navigates, the socket drops, the runtime
   *  tears down, or a one-shot reader takes its frame and leaves. Two
   *  readers of one key are two calls, two holds, two releases; an
   *  interrupted reader releases only its own. Absent, the `get` stream is
   *  byte-identical to today's. Typed `never` in the error channel: a hold
   *  cannot fail; a defect in it crashes that subscription loudly. */
  holders?: (key: K) => Effect.Effect<unknown, never, Scope.Scope>;
}
```

### 2b. The mechanism

In `collectionHandlers`, only the `get` arm changes (`server.ts:857-861`):

```ts
get: (input) => {
  const live = () =>
    subscribeBeforeSnapshot(deps.perKeyBus(input.key), () => {
      const v = readOne(input.key);
      return v === undefined ? [] : [v];
    });
  const holders = deps.holders;
  return holders === undefined
    ? live()
    : Stream.unwrap(Effect.map(holders(input.key), live));
},
```

**Semantics:**

- *Pull order:* `Stream.unwrap` runs the holders effect first and only then
  constructs the inner stream, so the sequence per subscription is
  **hold → channel subscribe → `readOne` snapshot** — exactly the order
  `holding.ts:110-122` spells and its test pins ("the hold is taken before
  the wrapped handler runs"). That test's assertion moves upstream into
  `server.ts`'s suite as the framework's own pin: the pull order is contract,
  not implementation accident.
- *Release:* the hold is acquired in the returned stream's scope — the same
  scope `channelSubscription`'s `acquireRelease` rides — so interruption
  **anywhere**, including between the hold and the subscribe or mid-snapshot
  inside `readOne`, releases exactly once. A subscription nobody ever runs
  holds nothing (the stream is lazy; `unwrap`'s effect runs on first pull).
- *Multiplicity:* every `get` call is its own stream, own scope, own hold —
  two readers, two holds; the first to leave takes only its own. The
  refcount itself lives on the consumer side of the seam (olai's
  `bodies.ts` map): the framework reports lifetimes, it does not count.
- *Failure:* the error channel is `never`, so failure is unspellable. A
  defect (a throw inside the consumer's hold) propagates as a defect and
  kills that one subscription loudly — fail-fast, no degrade-to-unheld path,
  no catch-and-continue.
- *Scope:* `get` only. `keys` and `deltas` are collection-wide streams; "who
  holds this key" has no meaning there, and folding a collection-wide hold
  in would be a second axis on the same knob. Deliberately not offered.
- *Back-compat:* `holders` absent → the exact expression served today, not a
  wrapped equivalent — zero overhead, zero behavior delta, for every
  existing collection in kolu, drishti, and odu.
- *Not on the spec:* no wire member, no verb, nothing crosses the socket. A
  release verb a closed tab cannot send stays a promise nobody can keep
  (`holding.ts:22-28`); the transport notices, so the transport is asked.

### 2c. olai after

`@olai/surface`'s `holding.ts` and `holding.test.ts` are **deleted whole** —
the `Keyed` type, the `surfaceTag` spelling, the `emptyHandlers` rebuild,
the `Stream.unwrap` wrap, all of it (the pull-order test's substance
survives as the upstream pin, 2b). `runtime.ts`:

```ts
documents: {
  readAll: () => held?.documents.entries ?? NOTHING_YET,
  readOne: (key) => { /* unchanged, incl. bodies.unread([key]) */ },
  holders: bodies.held,          // ← the seam, where the header said it goes
  upsert: () => {},
  remove: () => {},
},
// ...
return {
  bound: runtime,                // ← the wrap at :757 is gone
  // ...
}
```

**What remains, named:** `bodies.ts` entirely — what a hold is *worth*
(read-on-held, publish, the one-at-a-time queue, drop-if-released-before-read)
is olai's and stays; `readOne`'s `bodies.unread([key])` ask stays;
`documents.tsx`'s client-side `askers` map stays (separate axis, see below).
The wrap-at-the-composition-root paragraph (`runtime.ts:744-754`) dies
better than it lived: with the fact inside the handler deps, every face
built by filtering the handler record inherits it **by construction**, not
by wrap ordering.

---

## Edge cases checked against the real code

1. **First frame vs snapshot (F1).** The wire's first frame *is* a
   `snapshot` (`server.ts:890-899`), so the fold's `init` covers first
   frame, reconnect, and mid-stream seeding with one arm — no special case,
   and olai's patcher already treats "nothing standing" as rebuild
   (`patch.ts:143-144`, cited by `deriving.ts:139-147`).
2. **Removes of unknown keys (F1).** Produced for real by the coalescer's
   last-op-wins (`server.ts:695-698`). Store: no-op (today's behavior,
   preserved). Fold: contract obliges `step` to tolerate; olai's `patch`
   already does (`byFile.delete` on absent, `patch.ts:266`).
3. **A fold consumer arriving mid-stream (F1).** The keyed cache shares one
   slot per collection (`surfaceClient.ts:1181,1223`), so a late fold cannot
   replay the wire's snapshot — it is seeded synchronously from the held
   store as a synthetic snapshot. During `pending()`, it reads `undefined`.
4. **Holder effect failing (F2).** Unspellable as a typed failure (`never`);
   a defect crashes that one subscription loudly rather than serving it
   unheld — the fail-fast arm, checked against `Stream.unwrap`'s defect
   propagation.
5. **Interruption during `readOne` (F2).** The hold is acquired before the
   snapshot thunk runs; scope close releases it and the channel subscription
   exactly once (`channelSubscription`'s single `acquireRelease`,
   `server.ts:353-378`). The body read that `bodies.unread` queued is then
   dropped at take time by the `holders.has(path)` re-check
   (`bodies.ts:136-140`) — the released hold makes the late read a no-op,
   with no framework help needed.
6. **Reconnect under the retry fence (F1).** A transport drop reaches the
   hook as a fresh snapshot, never an error (`createSubscription.ts:15-18`).
   Store: value-diff, unchanged entries don't re-notify (preserved from
   today). Folds: re-init — one honest full rebuild per reconnect, which is
   what the wire actually delivered.
7. **Ownerless registration (F1).** `fold()` outside a reactive owner
   throws; the `onError` registry's net-zero treatment
   (`surfaceClient.ts:1188-1221`) was studied and rejected for folds — it
   would mint an instantly-dead accumulator.

---

## Deliberately not designed

- **Client-side `askers` refcounting** (`documents.tsx`) into `holders`. The
  debate's own guard: two axes, two doors. The client half can hear
  `onCleanup`; the grenade was the half that could not.
- **A `lastDelta` accessor.** It is `fold` with `acc = frame` — a second
  spelling of the same socket, and the copying variant of it is a rejected
  shape by name. One primitive.
- **A fold on the per-key path.** No frames exist there; synthesizing them
  from N per-key streams would be the framework building a voltmeter to
  serve one.
- **A declared keyed merge for array elements inside values.**
  `writeValue.ts:41-47` is explicit that this needs a spec-level
  declaration with a call site; nothing in either finding requires it, and
  smuggling it in here would be the inheritance-from-default that file
  exists to forbid.
- **`holders` on `keys`/`deltas`, or an `onIdle`/last-reader-anywhere
  callback.** The collection-wide question is a different fact with no
  consumer; optional-and-unadvertised helpers are how the LRU shipped, but
  so is speculative surface.
- **Moving `@olai/format`'s `patch`, or touching `rev`.** Policy stays
  app-side; the wire's change-token contract stays. Ruled by the debate;
  restated here only because both are one careless "cleanup" away.
- **Shipping mechanics** (not design, but binding at implementation):
  both findings are API-facing changes to `@kolu/surface`, so they carry the
  drishti pair-PR gate and the odu-impact verdict, plus the
  `ref-surface.mdx` Reference update, per `.claude/rules/surface.md` /
  `surface-reference.md`. Both are additive (`fold` new, `holders`
  optional), so the expected drishti/odu verdict is adoption-opportunity,
  not breaks-at-bump — to be confirmed by the mandated grep, not assumed
  here.

---

## Does kolu itself benefit?

Surveyed at kolu HEAD (`ac9c80798`, this worktree), plus the local drishti
and odu checkouts (`~/code/drishti`, `~/code/odu`) — the human's list named
them, and both are declared production consumers of `@kolu/surface*`
(`.claude/rules/surface.md`). The short answer: **kolu-the-app gains nothing
today from either finding; drishti is a real finding-1 payer twice over,
including one hand-rolled reconstruction the survey turned up; odu's logs
store is a real finding-2 shape.** One design amendment falls out
(recorded at the end).

### Finding 1 — who pays the whole-dict copy or reconstructs frames

**Kolu the app: nobody.** No kolu-owned surface declares the `deltas` verb
at all — it is opt-in (`define.ts:108-110`) and unclaimed: padi's two
collections are `["keys", "get"]` (`padi/src/surface.ts:1600, 1608`),
surface-map's `entries` is `["keys", "get"]` (`surface-map/src/define.ts:838`
— and its keysBus is *deliberately* un-coalesced for the MapRegistry
membership contract, `server.ts:717-721`), and kolu's common surfaces
(`common/src/surface.ts`, `contract.ts`) declare no collections. The
`hasDeltas` arm of the bound `.use()` (`surfaceClient.ts:1250-1268`) is
therefore dead code for every kolu spec; `useCollectionDeltas`'s only
in-tree production caller is that arm. Kolu's benefit from 1a is as
framework owner (the bench/test pins move), not as consumer.

**Drishti: pays twice, in two different ways.**

1. *`processes` — the reconstruction case, deriving.ts's sibling.*
   `foldProcessDeltas` (`app/src/client/App.tsx:144-157`) is a hand-rolled
   client fold over the raw `unenrolledDeltas` stream: it copies the whole
   `Record<Pid, Process>` per delta frame (`{...prev}`, line 153), then
   `createSubscription`'s reduce path reconciles the whole map again
   (`App.tsx:1275-1295`) — both O(N) passes, per poll tick, over the htop
   table (hundreds+ of pids, ticking continuously; `equals: processEqual`
   dampens rows but cpu/mem move most ticks). Why it exists is the
   survey's sharpest fact: drishti *needed* the un-enrolled reach (the
   #1591 health carve-out — no per-host gate to flicker), and
   `useCollectionDeltas` is **not exported** from the solid barrel
   (`solid/index.ts:140-144` exports only `useCollection`), so the app
   rebuilt the framework's fold by hand — the same "the client library
   swallows the frame, so the consumer re-measures" shape as olai's
   `deriving.ts`, one altitude down.

   *After:* `useCollectionDeltas` (redesigned, exported — see amendment)
   takes the same caller-provided `source`, so the carve-out survives:
   `foldProcessDeltas` and the manual `createSubscription` are deleted;
   `processes()[pid]` becomes `byKey(pid)?.()` (the table's fine-grained
   `processes()[pid].cpuPct` reads — the R8b requirement the comment at
   `App.tsx:1268-1271` pins — are exactly the merged store's per-key
   contract); `allPids` reads `keys()`. Cost per tick drops to O(|frame|).
   Drishti does *not* need the `fold` combinator here — its accumulator IS
   the keyed map, which is the store; the merge half is its whole benefit.

2. *`cpuCores` / `networkInterfaces` / `unclaimedListeners` /
   `sourceErrors` — the silent-tax case.* Four more `deltas`-declaring
   collections (`common/src/surface.ts:480, 486, 502, 513`) consumed
   through the enrolled `.use()` (`App.tsx:1297, 1304, 1400, 1405`), so
   they ride `foldCollectionDeltas`'s copy + the whole-dict reconcile
   today with no code of their own. Zero code change after; honest
   sizing: cores/NICs declare no `equals` and republish every key per
   tick (`surface.ts:499-501, 511-512`), so |frame| ≈ N there and the win
   is the second O(N) pass plus per-frame allocation churn, not
   asymptotic; `unclaimedListeners`/`sourceErrors` are small, mostly
   quiet sets — the win is real and small. No inflation claimed.

**Odu: not a finding-1 consumer.** Its one collection (`logs`,
`mcp/agentSurface.ts:246`) declares no `verbs`, so it gets the default
`["keys", "get", "upsert", "delete"]` — no deltas stream exists on it.

**Non-benefits, named:** drishti's `metricHistory` (`App.tsx:303-310`) and
odu's `nodeLog` are STREAM members with domain-specific snapshot/delta
protocols — `createSubscription`'s `reduce` is the right tool there and the
collection-frame socket does not apply. Kaval's per-terminal output rides
its own `FanOut.subscribeWith` snapshot-fusion (`kaval/src/fanOut.ts:124-135`),
a different protocol with a stricter race guarantee; not this socket.

### Finding 2 — who guesses at last-reader lifetime

**Kolu the app: nobody.** The only `collectionHandlers` sites are padi's
`terminals`/`daemonStatus` — `readOne` is a cheap registry compose
(`padi/src/servePadi.ts:566-573`; the registry IS the store, nothing is
loaded per reader, nothing to release) — and surface-map's `entries` (same
shape). Kolu's keyed *expensive* lifetimes are all stream-scoped already:
kaval's PTY attach releases its fan-out queue on scope close
(`fanOut.ts:128-135`; `subscriberCount` at `fanOut.ts:119-121` is
diagnostics for the leak *proof*, `kaval/src/index.ts:60-66`, not an
inference mechanism), and padi's fs/git watcher streams tie kolu-git's
refcounted `@parcel/watcher` subscriptions to stream teardown through
`pulseSource` (`padi/src/fsGitDeps.ts:50-70`). The last-reader fact is
heard everywhere it matters in kolu — because those paths are streams,
whose deps already receive the scope. The gap `holders` fills is specific
to collection `get`, and kolu serves no expensive collection values.

**Odu: a real payer.** `makeLogsStore` (`mcp/agentSurface.ts:381-440`) is
the bodies.ts shape with the release half missing: a cache-miss `readOne`
starts `follow(id)` — a live upstream `nodeLog` subscription that
accumulates and republishes — and the follow "stays open until the stream
ends (run done / link drop)" (`agentSurface.ts:395-397`) because odu cannot
hear the last reader let go. Every id ever read stays followed and resident
(clamped to 64KB each, `agentSurface.ts:377-379`) for the run's lifetime —
bounded by clamp-per-entry rather than by readership, the same
"a bound with no honest number in it" olai's LRU was.

*After:* `holders: (id) => logsStore.held(id)` on the logs collection's
deps — an acquire/release count exactly like `bodies.ts:163-174`; on last
release, cancel the follow's iteration and drop the cache entry; the
durable-file fallback stays the miss answer. The pull order fits as-built:
hold before `readOne` means the first read runs against a counted reader.
One honest consequence odu would own: a one-shot MCP `resources/read`
holds and releases within one read, so back-to-back one-shots would
re-read the durable file instead of a warm cache — whether to linger a
follow past zero is odu's policy question, not the framework's. And the
timing caveat: odu rides the loose npins pin, so this lands as an
adoption-opportunity line on the odu#43 ledger at the next bump, not as a
change today.

**Drishti: no finding-2 consumer.** Its five collections are derived
poll-reconciler views over in-memory maps; `readOne` loads nothing.

**surface-mcp's pusher** (`pusher.ts:153-157, 197-199`) refcounts
*client-side* URI subscriptions (last-unsubscribe detaches the transport) —
that is the `askers` axis the debate explicitly kept out of `holders`, and
it already works; not a consumer.

### Amendment forced by the survey

Finding 1's design gains one line: **export `useCollectionDeltas` (and its
result type) from `@kolu/surface/solid`'s barrel.** Drishti's
`foldProcessDeltas` exists *because* the hook is barrel-private — the
un-enrolled carve-out had no way to reach the framework's fold and so
rebuilt it, copy included. The hook already takes a caller-provided
`source`, so exporting it serves the carve-out without touching the health
story. This goes on the `ref-surface.mdx` page with the rest, and makes the
drishti pair-PR the adoption vehicle for deletion #1 above rather than a
mechanical re-green.
