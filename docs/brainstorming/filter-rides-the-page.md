# The filter stops re-searching the vault

Roadmap node `filter-ask-carries-revision`, filed out of #290's deferral. The node
states the measurement and names two candidate shapes; this note picks one, gives
the wire shape, answers the reconnect question the node demands, and says what the
choice deletes.

Read against [vault-in-browser.md](vault-in-browser.md), whose §2 caveat —
*"updates to that" needs a mechanism* — is the paragraph this whole item lives
inside.

## 1. The defect, as measured

A filtered page is a STANDING view: which nodes a query selects has a different
true answer after every write, so an answer that outlives the set it was computed
over is a wrong answer that looks like a right one. `filter/asking.ts` holds that
line by putting the page's own generation in the question (`Ask.at`) and re-asking
whenever the page's reading moves.

Re-asking is a whole-vault `search.matching` — `@olai/ops`' `Query.matches` over
`@olai/format`'s `matching`, which walks `derived.nodes` end to end. So one bulk
gesture on a filtered page is one whole-vault walk per published revision. Measured
in #290 with `packages/tests/wire.ts`'s `filter` session over a 300 × 300 vault
(90,000 nodes): thirty rows picked and ticked off cost **nine** whole-vault
searches, one per frame.

#290 also measured the obvious client-side fix and threw it away honestly: a
leading-and-trailing throttle over a paint, plus a hold for the flight, took nine to
eight, which is the noise between two runs. The reason is in `asking.ts`'s own
comment and it is not a tuning problem — the frames of a bulk gesture arrive a
procedure round trip apart, which is already wider than any window short enough to
keep a filtered page's counts honest beside the tree they are drawn next to. No
window in the browser fixes this. The fix is on the other side of the wire.

## 2. The two candidates, and why (a) cannot work

**(a) The ask carries the page's revision, so an unmoved set is answered from what
was already computed.**

Refuted by the measurement itself. The nine asks are not nine asks about ONE
revision — they are one ask per revision, because each of the thirty writes
publishes a revision and each revision changes this page's reading. A cache keyed on
`(text, revision)` misses nine times out of nine. The only version of (a) that saves
work is one that reuses the PREVIOUS revision's answer incrementally, patching the
match set by the files that moved — which is `search-index`'s territory (a query
stops costing O(corpus)), a separate node the brief explicitly fences off, and a
second index to keep in step with the derivation for a question that, as §3 shows,
should not have been O(corpus) in the first place.

So (a) is a cache in front of a walk that should not be happening.

**(b) The narrowing moves to the server WITH the reading.** Taken, in the shape §3
gives.

## 3. What the whole-vault walk was actually for — nothing

Here is the fact that decides the design. **The answer to `search.matching` is only
ever consumed as a membership test against the rows the page already draws.**
Every reader of it is in `filter/drawn.ts`: `narrowed` prunes by `keeping` /
`keepingDated` / `keepingOwed`, and `placesIn` / `matchesIn` count over the same
rows. An id in the answer that the page does not draw is looked up by nobody.

`Query.matches`' own docstring says the walk is whole-set and calls that FORCED —
"a page draws MIRRORS, and a mirror shows a node that lives in another outline, so a
curated list filtered under `file:` would silently lose every row it is made of."
That is true of `file:` scoping and false of the scoping available on the server:
the page's READING has already resolved every mirror, so the records the page draws
are a set the server holds in its hand. `@olai/format`'s `page.ts` already walks
them — `drawnIn`, for the names table.

So the narrowing is not a search of the directory that a page happens to prune. It
is a question about a page, of the size of a page, asked as a question about the
directory. Answering it where the page is answered makes it O(page).

## 4. The shape

**A stream beside `page`, not a field on it.**

```
streams: {
  page:      PageRequest                    -> PageReading
  narrowing: { page: PageRequest, text }    -> { text, matches: [{ id, matched? }] }
  moving:    …
}
```

- `read` — `@olai/ops`' gated read, `@olai/format`'s `narrowingOf`: compute the
  page's `Shown`, walk the records it draws, run the matcher's own `matchOf` over
  each, answer the ids and the field that carried the hit.
- `install` — the same `revisions` pulse `page`, `dated`, `owed` and `moving`
  already consume.
- `isEqual` — `sameNarrowing`, derived from the schema. **A revision that did not
  move which nodes match sends no frame at all.**

Three legs, exactly the shape `vault-in-browser.md` §2 named as the mechanism and
`moving` established as the house pattern for a standing question keyed to something
the page knows.

### Why not a field on `PageRequest`

`page.ts` (both the format module and the surface member) says today that the
narrowing deliberately does not ride the page reading, because "a page reading that
took the query would be that door built twice, re-asked on every keystroke, with the
page's rows in every answer." That sentence survives this change and is the reason
the query does not join `PageRequest`: a stream re-opens whenever its input notifies,
so a settled keystroke would tear down the page's subscription and re-send every row
— ~104 kB on a 200-row outline, per word typed. What changes is the sentence's other
half: the narrowing is no longer "asked of the whole set", and it is no longer a
procedure. It is a page-shaped stream that costs a page.

### What two members cost, and where it is paid

Two subscriptions are TWO MOMENTS, and that is the one real price of not folding
the query into `PageRequest`. Both are read on the same pulse and delivered as
two frames. Drawn as each arrives, a pane opening a `?q=` address shows the page
WHOLE for one frame before its own query takes rows off it. That is not
hypothetical: it is the scenario `pin_to_sidebar.feature`'s "the node `demo` was
never drawn" already pins, against `reactivity-after-the-flip` §3.1's 1.6, and it
fails on the naive shape.

The join is made where both readings are DRAWN rather than by folding one into
the other's frame, and it has **two halves, because the arrival order is not
something either member promises.**

*The page lands first* — the one that happens. The pane holds the page it has
until the narrowing for it arrives (`filter/asking.ts`'s `Asked.awaiting`, spent
as `reading.tsx`'s `holding`). What was on screen stays on screen, and a pane
with nothing on screen yet draws its `Reading…` line — the beat
`vault-in-browser.md` §5a already licenses for a navigation. A keystroke makes
it true for one round trip over a page that has not moved, which is the
rows-hold-still rule and costs the pane nothing; a reading that FAILS drops the
hold, because no answer is coming and a page held for one that will not arrive
is a pane that never draws again.

*The answer lands first* — the page BEFORE, pruned by ids that name nothing on
it, which empties the pane. **Measured not to happen**: six runs of
`pin_to_sidebar.feature`'s narrowed-pin scenario with the gate bypassed, and the
page won every one. That is a fact about today's scheduling and not a promise —
two subscriptions opened in one tick arrive in whatever order the socket and the
two walks produce. So an answer is spent only on the page it is ABOUT
(`PageView.tsx`'s `together`, over `Reading.about` and `Asked.about`), and until
they agree the page draws whole with the bar saying `filtering…`, which is the
state the reading already defines for "nothing has answered this query yet".
What that buys is not a bug fixed — it is that the scenario may ASSERT the pane
never empties, instead of the assertion being a canary for scheduling.

So the cost is one arm of a four-state sum (`filter/asking.ts`'s `Standing`), one
optional argument and one comparison, and what it buys is the keystroke traffic. **The
alternative was designed and costed rather than waved away**: fold the query
into `PageRequest`, carry `matched` on `PageReading`, and every invariant the
join enforces becomes unspellable — one value, one moment, and `awaiting`,
`holding`, `sameNarrowingRequest` and this whole member deleted. What makes it
non-viable is one number, off the same instrument: a page frame on the measured
vault is **~52 kB** (1,552 kB of page frames over the gesture's thirty writes),
and a settled keystroke re-opens the subscription, so it pays that per word
typed. The narrowing frame beside it is **~3 kB**. Seventeen times the traffic,
on the one door in this app whose whole promise is that it narrows as you type,
is not a trade the simpler shape wins.

**Named, at population one:** "two members of one surface, drawn as one moment"
is a volatility a framework could hold — a joined subscription that is pending
until every leg has answered, and whose value is the tuple. Kolu's surface is
where it would live, beside the enrolment and the change-iff-fired law it would
inherit. It is one consumer today, so nothing is extracted and nothing is
blocked on it; this is the recording, so the second consumer has something to
point at.

### Why the reader's own hiding stays out of it

The server does not prune. It answers the SELECTION and the browser prunes, exactly
as it does now, because done-hiding is a preference of this browser and goes FIRST
(`filter/narrowing.ts` argues the order, and `count.ts` is the arithmetic that order
exists to keep honest). A server that pruned would need the preference on the wire,
which is the one thing `vault-in-browser.md` and `page.ts` both rule out — and
`hiddenAsDone` cannot be counted at all without both the pruned and the unpruned
page. So the division of labour is untouched: **the server says which nodes; the
page says which rows.**

### What crosses, and what it weighs

The answer is `{ text, matches: [{id, matched?}] }`, bounded by the page rather than
by the corpus. `text` is echoed because it is what tells the bar whether the rows on
screen answer what is typed (`Narrowing.answering`) — read off the value that holds
the rows, never off a signal beside it that is free to be a frame ahead. This is
the same field `Answered.text` is today, kept for the same reason.

On the measured session that is the difference between an answer carrying up to
90,000 ids and one carrying at most 300.

## 5. What the reconnect re-ask becomes — nothing

The node asks this explicitly, and the answer is the strongest argument for (b).

Today the reconnect story is a paragraph of `asking.ts`: a reconnect re-opens the
subscription with a full snapshot, the page's generation moves, and the standing
query is asked again through `Ask.at` — plus a documented tail (a settle already
ticking when the wire drops fires a call into a dead socket, whose failure is drawn
behind the overlay where nobody reads it).

Under (b) there is no re-ask to write, because there is no ask. A narrowing is a
subscription, and a reconnect re-opens every subscription with a fresh snapshot —
the same recovery `page` and `moving` get, from the same seam, with the
change-iff-fired law meaning an EQUAL reconnect snapshot notifies nobody at all. The
generation, the staleness guard and the dead-socket tail all leave with the
procedure:

- **The generation** (`Ask.at`, and the whole `sameAsk` value) — the server re-reads
  on the pulse; the browser holds no token about a set it does not have.
- **The staleness guard** — `createReactiveSubscription` re-arms its lifecycle when
  its input moves (fresh fiber, signals reset), so an answer or an error belonging
  to the query before cannot land on the query now. That was `answering(ask)` and
  the `untrack`ed re-read of the source; it is the framework's law now.
- **The dead-socket tail** — a settle that fires into a dead socket opens a
  subscription instead of sending a call, and the seam retries it. Nothing is sent
  and nothing is refused.

What does NOT leave is the debounce: a keystroke still may not be a subscription
re-open, so `SETTLE_MS` and the arrival-versus-keystroke rule stay exactly where
they are. And what does not leave is the FAILURE line under the box: a subscription
carries `error()`, so the bar keeps the slot it has and `count.ts`'s three states
are unchanged — a stopped narrowing is also named by the connection readout, because
`.use()` enrols it, which is one more thing a procedure had to hand-roll.

## 6. What it deletes

Per the vault-in-browser law — a change deletes whatever it replaces, in the same
diff, and ships nothing unused:

- `search.matching` as a wire member, `Ops.matching`, `Query.matches`, and
  `MatchingRequest` / `MatchingAnswer`. `MatchedNode` survives: it is what the new
  answer is made of. `search.nodes` and `@olai/format`'s `matching` are untouched —
  the palette, the header box and an agent's `search_nodes` are still callers of the
  one matcher.
- `Ask`, `sameAsk`, `Ask.at`, the `createResource` and its `answering` guard in
  `filter/asking.ts`, and `sameMatches` in `filter/matches.ts` (a stream whose
  `isEqual` is the server's does not send the answer that was already on screen, so
  there is nothing left for a client-side value memo to catch).
- `showsTrashed` in `filter/drawn.ts` — the scope question is answered where the
  page is, off `Shown`, so the browser stops telling the server about a page the
  server is already reading.

One thing is ADDED to the browser rather than deleted from it, and it is the
join of §4's last subsection: `Asked.awaiting`, and the `holding` argument
`createReading` takes for it. Two lines and a predicate, against a stale scope
flag, a generation, a staleness guard and a whole `Ask` value.

`Reading.at` and `useFrames` STAY: the row editor reads them to suppress a blur
while it waits for the frame that redraws a row it just moved. The filter was one of
two readers, not the only one.

## 7. The cost, owned

**The page reading is computed twice per revision on a filtered page** — once for
`page`, once for `narrowing`. That is O(page) paid twice instead of O(page) plus
O(corpus), and on the measured vault it is a 300-row walk in place of a 90,000-node
one. A per-revision memo keyed on `(revision, request)` in the ops layer would
collapse it, and is deliberately not built here: it is state no other reading has,
and it would be a cache in front of a walk that is now the right size. Filed as a
sentence rather than as a node, because nothing measures it as a problem.

**`isEqual` runs a schema equivalence over the answer per revision.** Same shape as
`samePageReading` and for the same purpose; it is what makes a bulk gesture silent.

## 8. What it promises, and how it is measured

`packages/tests/wire.ts`'s `filter` session is the instrument and is the acceptance
test. It counts what the tab SENT, so it counts the same gesture on both sides —
one driver, `ROOT=` pointed at the branch's base and at the branch, over 300
outlines × 300 rows (90,000 nodes), `?q=title`, thirty rows picked and ticked off
in one gesture:

| | before | after |
|---|---|---|
| matcher asks, opening the filtered page | 1 | 1 |
| matcher asks over the gesture | **9** | **0** |
| socket bytes, page opened | 2,076.5 kB | **320.2 kB** |
| socket bytes, whole session | 31,534.1 kB | **1,872.8 kB** |

The ask counts are deterministic — the same gesture, the same writes, the same
frames. The byte columns move by a few hundred bytes between runs of one branch
(a heartbeat, a git probe), which is why the ratios below are the honest figure
rather than either number.

Zero rather than one, because the ask is not per frame any more: the page opens one
subscription for its query, and thirty writes that do not change which nodes match
send it nothing. The driver counts both members' tags and self-proves on their sum,
so a renamed tag still fails loudly rather than reporting a spectacular zero.

**The bytes are a second win nobody asked for**, and they are the same fact from
the other side: a whole-vault answer to `title` on this vault is 90,000 ids, and it
crossed the wire ten times. The answer is bounded by the page now — at most 300 ids
— so the session weighs **16.8× less** and the first narrowed paint **6.5× less**.

## 9. What this does NOT change

- **Search semantics.** One grammar, one matcher, one ranking. The new reading calls
  the same `matchOf` behind the same `parseFilter`, and is held to `matching` by an
  oracle test: for any page and any query, the ids it selects are exactly the ids
  `matching` selects that the page draws.
- **Agents and MCP.** `search.matching` was the browser's alone; the agent face
  never had it. `search_nodes` is untouched.
- **The format.** No field, no file shape, no validation rule.
- **`search-index`.** Still open, still separate. What this removes is a walk that
  was the wrong SIZE; that node is about a walk that is the right size and still
  costs O(corpus) for the doors that genuinely search the directory.
