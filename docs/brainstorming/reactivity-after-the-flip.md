# Fine-grained reactivity after the flip

Roadmap node `reactivity-after-the-flip` (under Regressions; the offending PR is #279, `vault-in-browser` PR 10). The human's report, 2026-08-20: *clicking an entry in the sidebar opens the page in the main pane, but the whole sidebar re-renders and flickers on every such click — which says the flip was done in a way that disrespects Solid's fine-grained reactivity.* The ask was to identify **every** such violation, not just the one reported. This doc is the audit, written so that an agent can take it and finish it without re-deriving anything: §1 the symptom measured, §2 the two framework facts everything hangs off, §3 the findings with `file:line`, §4 what is already right, §5 the PRs, §6 how to reproduce and test.

All line numbers are against master on 2026-08-20 (`packages/web/src/client`, unchanged since #279 merged as `7e208f77`). Treat them as ±5.

## 1. The symptom, measured

A headless Chromium (the `#e2e` nix shell's Playwright) was pointed at a scratch copy of `packages/tests/fixtures/good` with two extra files, `notes/second.md` and `notes/third.md`. Before each click every element under `[data-testid=sidebar]` was tagged with a serial; after the page settled the tags were counted again, and a `MutationObserver` on the sidebar and on the pane recorded what moved (the script is in §6).

| Navigation | Sidebar elements destroyed | Sidebar mutations | Pane mutations |
|---|---|---|---|
| `/notes/palette.md` → `/notes/second.md` (same folder) | **16 of 178** | `li[file-dir](path=notes)`: `<ul>` **removed**, `data-collapsed false→true`, `aria-expanded true→false`, triangle `-rotate-90` added; then a **new** `<ul>` inserted, `data-collapsed true→false`, triangle restored; `aria-current` set on the new link | `section[document-page]` removed → `<p>Reading…</p>` added → removed → new `section[document-page]` + `div[document-body]` |
| `/house.olai` → `/garden.olai` (top level) | 0 of 162 | `aria-current` removed from house, then set on garden | `div[filter-bar]` + page removed → `<p>Reading…</p>` added → removed → new `div[filter-bar]` + page |

So "the whole sidebar re-renders" is three things the eye reads as one: the open file's **folder chain folds and is rebuilt** on every navigation inside it, the **current wash goes dark** for one round trip, and the **main column remounts** (filter bar included) beside it. The first two are pure regressions — the pre-flip sidebar derived its active file from the route and never moved. The third is the round trip §5a of `vault-in-browser.md` accepted, but §5a accepted a *wait*, not a *teardown*.

## 2. Two framework facts everything below hangs off

Both live in `node_modules/@kolu/surface/src/solid/` (hydrated from the npins kolu pin by `just install` — run it first; a stale `node_modules` fails at boot with `Export named 'isPrivateOwnedDir' not found`).

**Fact A — a stream blanks on every input change.** `createReactiveSubscription.ts` (behind every `olai.streams.X.use(inputFn)`) does, inside `on(inputFn, …)`: `setStore("v", undefined)`, `tracker.reset()`, tear the old stream down, open the new one. Two consequences: (a) an `inputFn` that returns a fresh reference without an `equals` guard re-subscribes whenever anything it reads *notifies*, value change or not; (b) a genuinely new request makes the value `undefined` for one round trip. (b) is correct for the pane that asked; it is wrong for every piece of chrome that *derives* from that pane's answer.

**Fact B — every array element is a new object on every frame.** `writeValue.ts` writes each frame with `reconcile(next, { key: null })` and **no `merge: true`**. Verified against the installed Solid 1.9.14 (`node --conditions=browser` over `node_modules/.bun/solid-js@1.9.14`) by replaying an *identical* frame:

```
identity kept:  shows ✓  shows.rows (array) ✓  names (array) ✓
identity lost:  rows[0] ✗  rows[0].node ✗
notifies on an identical frame: rows[$TRACK] 1 · rows[0] 1 · rows[0].node.title 1 · names[$TRACK] 1
```

With `key: null` and no `merge`, `applyState` diffs arrays by reference; nothing off the wire is `===` the previous element, so every `Row`, `Named`, crumb, `Backlink`, `Referrer`, `DayEntry` is replaced wholesale, and `arr[$TRACK]` fires. (`{ key: null, merge: true }` would recycle by index; `key: "key"` would recycle by the row key where one exists.) So: `reading.page()`, `.shows`, `.shows.rows`, `.names`, `.zoomed` are frame-stable — `PageView`'s `page`/`allDrawn` memos do not re-run per frame — but **anything keyed by reference over a wire array remounts on every frame of that page**, and anything reading a row through a `<Key>` item signal re-evaluates all of its bindings for all rows.

## 3. The findings

Severity: **A** = DOM remount / flicker or a wire re-subscription / re-ask; **B** = wasted recomputation; **C** = stale or wrong UI. Verification: **M** = measured in a browser (§1 or the Fact B replay); **R** = the full code path was read and the claim rests on nothing unverified; **r** = reasoned from code, not run.

### 3.1 Root cause 1 — chrome derived from a value that blanks (Fact A)

`App.tsx:118-212` derives the sidebar's `active` (`openFile`), the calendar's `openDay`, the palette's `names` and `zoomed`, and undo's file from `focused()` — the focused pane's **reading** — instead of from the **route**, which already knows synchronously. Every navigation therefore sends `A → undefined → B` through all of them.

| # | Where | Effect | Sev | Ver |
|---|---|---|---|---|
| 1.1 | `Sidebar.tsx:172` `openAncestry` ← `props.active` | The open file's folder chain folds (`<Show when={!folded()}>` at `:476`) and is rebuilt one round trip later | A | M |
| 1.2 | `Sidebar.tsx:176` `createSelector(() => props.active)` | Current wash off for a round trip | A | M |
| 1.3 | `calendar/Calendar.tsx:73-79` `anchor` ← `props.open`; `dates.ts:111` `dated.use(() => ({ month: month() }))` | On a day page in a non-current month, clicking another day flips the shown month (Jul→Aug→Jul), rebuilds all ~30 cells twice (`<For each={monthGrid(month())}>` keys strings by value) and tears down / re-opens the `dated` stream twice; the dots blank to an empty set in between | A | R |
| 1.4 | `pane/PageView.tsx:181` `<Show when={narrowing.drawn().kind !== "none"}>` | `drawn()` collapses to `NOTHING_DRAWN` while `page()` is undefined → the FilterBar and its `<input>` unmount and remount on every navigation | A | M |
| 1.5 | `pane/PageView.tsx:~185` `<Show when={page()} fallback="Reading…">` | The whole page remounts on every navigation, even outline → outline | A | M |
| 1.6 | `filter/asking.ts:256-280` | `question` reads `source.page().kind !== "none"`; on the blank it becomes `null` → `settle.clear(); setAsked(null)` → `held()` undefined → the page draws **whole** with the bar saying "filtering…", and when the page lands the text is re-**debounced** (200 ms) before it is asked. A `?q=` destination (a pin, Back) draws whole, then narrows 200 ms + RTT later | A | R |
| 1.7 | `App.tsx:191-195` `createEffect(on(openFile, () => undo.clear(), { defer: true }))` | `undo.clear()` fires **twice** per navigation, and a same-file zoom in or out goes `A → undefined → A` and wipes the outline's stack — contradicting `edit/undoing.ts:82` ("the edits you made on this outline"). Pre-flip (`1cc4cd65` `App.tsx:129-133`) `openFile` was synchronous from the route and same-file zooms kept the stack | C | R |
| 1.8 | `pins/palette.ts:52` `nameOf(route, shownIn(names, route))` | With the palette open across a navigation, the pin row shows the bare address, then the title | C | R |

**The fix, one shape for all eight.** Derive "where am I" from the focused **route**, synchronously: `fileNamed(route)` for file routes, `route.date` / `today()` for day routes; consult the reading only for what the route cannot say (the canonical file of a `/#id` node — and even there, hold the previous answer until the new one lands rather than passing `undefined` through). In `PageView`, hold the last `shows` across the blank — a memo whose `equals` treats `undefined`-after-a-value as "unchanged" (or a `createStamped`-style hold keyed on the request) — so a navigation **swaps** the page when the answer arrives instead of tearing it down to `Reading…`; keep the `Reading…` line only for a pane that has never had an answer. Gate the FilterBar on `narrowable(route())` (route-only). In `asking.ts`, clear `asked` only when `query().kind !== "asking"`, not when the page is merely absent, and skip the settle when the question returns equal to `untrack(asked)`. Undo clears on the *held* file changing.

### 3.2 Root cause 2 — `<For>` by reference over arrays that are rebuilt every frame (Fact B)

Each of these tears its DOM down on every frame of its page (every committed keystroke on it, any write elsewhere that moves a row on it, a rename of anything it names), or on every answer / keystroke where noted. Fix: `<Key by="…">` from `@solid-primitives/keyed` on the stable key named, or `<Index>` where the list is positional — the way `search/Shortlist.tsx:273`, `complete/Completions.tsx:68`, `NodeRefs.tsx:82` and `trash/TrashPage.tsx:115,140` already do.

| # | Where | Remounts | Key | Sev | Ver |
|---|---|---|---|---|---|
| 2.1 | `Breadcrumbs.tsx:62` `<For each={props.trail}>` — fed by `NodePage.tsx:88` and `day/DayNode.tsx:116,166` | Every crumb `<Link>`+`<NodeTitle>` on every frame of a zoomed page; on a day page every entry's trail | `crumb.node.id` | A | R |
| 2.2 | `document/Referrers.tsx:97` `<For each={props.found}>` | Every referrer row per frame while the `<details>` is open | referrer path / node id | A | R |
| 2.3 | `edges/EdgePanel.tsx:113,146` `<For each={held()}>` — `held` is a fresh array of fresh `NodeRef`s every time `names()` changes, i.e. every frame (3.3 below) | Every see/after chip while the panel is open — focus on an `×` lost mid-edit | `one.id` | A | R |
| 2.4 | `props/PropsDrawer.tsx:53,66` `<For each={entries()}>` — `customEntries(props.node)` mints fresh entries; `props.node` is new per frame | Every prop chip of every open row and of the zoomed heading, per frame | `entry.key` | A | R |
| 2.5 | `pins/Shelf.tsx:100` `createMemo(() => pinsOf(shelf()))` (`pins/pins.ts:169-173` mints a fresh `Pin` per row) + `:220 <For each={pins()}>` | Every `<Pin>` (Link, Face, × button) on any pins frame — one pin added, one reorder, or one pinned node retitled anywhere | `pin.id` | A | R |
| 2.6 | `palette/Palette.tsx:261-292` `items` (`pinItem` + `nodes.hits().map(hitItem)`, fresh objects) + `:767 <For each={[...items()]}>` | The pin row and every hit row on every keystroke during the 200 ms settle, hits unchanged; `opRows` (`:257`) likewise while `zoomed.under` moves | item id | A | R |
| 2.7 | `chat/Composer.tsx:290-333` `rows` (fresh `MenuRow`s per keystroke / hit frame) → `chat/CompletionMenu.tsx:109 <For each={props.rows}>` | All `@` rows and section headers per keystroke | `value`, or `<Index>` | A | R |
| 2.8 | `search/HeaderSearch.tsx:143-159` (and `:129-139`) `<For each={[...items()]}>`; `items` (`:29`) maps `hitItem` | All ≤8 rows per answer (hover/active state rebuilt) | `<Index>` | A | R |
| 2.9 | `filter/FilterBar.tsx:174-182` `<For each={[...props.narrowing.refusals()]}>`; `narrowing.ts:617-620` returns fresh objects from every `parseFilter` (per keystroke, `PageView.tsx:99`) | Each refusal `SaidLine` (`role="alert"`, `aria-live="assertive"`) per keystroke — **re-announced** to a screen reader | `token`, or `<Index>` | A | R |

Two B-grade fan-outs from the same fact:

| # | Where | Effect | Fix | Sev | Ver |
|---|---|---|---|---|---|
| 2.10 | `reading.tsx:192-201` `namesIn` — `names.map(one => [one.id, one])` tracks every index; each frame replaces every element → the `named` memo returns a new closure | Every `NodeTitle` face memo (`NodeTitle.tsx:285`), every `EdgeRefs.tsx:64` / `EdgePanel.tsx:113` `namedBy` memo and every `NodeRefs` `<Key>` re-run for every row on the page whether or not a name changed; `App.tsx:206`'s copy feeds the palette the same way | `equals` comparing `names` by value (id, title, file), or build from `unwrap(reading.names)` | B | R |
| 2.11 | `Tree.tsx:170-171, 809-811` `<Key each={rows} by="key">` | DOM survives, but `keyArray` calls `setItem(newProxy)` for every row on every frame, so every `Branch` binding reading `props.row` (~25 attributes, `Glyph`, `NodeLine`, `NodeTitle`, `Aside`/`hotOf`, `isOverdue`×2, `customEntries`, `NodeBody`'s `line` memo with `plainLine(desc)`, `doneUnder` for collapsed rows, `Blocked.tsx:37`) re-runs for every row for a one-character change in one row. The comment at `Tree.tsx:163-169` already says "fresh rows every frame" | Not fixable client-side without a declared per-array key — it is the upstream item (§3.5) | B | M |

### 3.3 Root cause 3 — reactive inputs without an `equals`, driving re-subscriptions and re-asks (Fact A's clause (a))

| # | Where | Effect | Fix | Sev | Ver |
|---|---|---|---|---|---|
| 3.1 | `document/Hypertext.tsx:623` `createEffect(on(() => [rev(), landingAt()], show, { defer: true }))` | `on` has no equality; `router.landing()` notifies with a fresh `{index, at}` on every push to a heading address in **any** pane (`router.tsx` `setLanding(land)` in `commit`), and with `undefined` on the next navigation after one. So pane B navigating to `/doc.md#x` **reloads** the `.html` preview's iframe in pane A (`show()` re-points `iframe.src`), and again on B's next navigation | Drive `on` from a string memo: `` createMemo(() => `${rev() ?? ""}|${landingAt() ?? ""}`) `` | A | R |
| 3.2 | `chat/Composer.tsx:198-204` `subjects` memo (no `equals`, fresh array, reads `draft()`) + `chat/chips.ts:48-66` effect tracking `ids()` | One `olai.procedures.nodes.named` wire call **per keystroke** for the whole typing session while any chip is armed; with nothing armed, `setTitles(new Map())` per keystroke. The `live` guard only prevents stale overwrite, not the storm | `createMemo(…, { equals: sameIds })` | A | R |
| 3.3 | `move/moving.tsx:303-307` sets `standing` to `{kind:"landed"}`; nothing resets it to `null` when `saying.said()` expires (`close` is only reachable from the unmounted picker; the refound effect at `:207-225` only nulls on the record leaving the page) | The `moving` stream (`:241-244`) stays open **indefinitely** with the last `{record, to}` and the refound effect keeps `flatten(page.rows(), page.collapsed())`-ing on every frame; a second picker then re-subscribes twice | `createEffect(on(saying.said, s => { if (s === null && standing()?.kind === "landed") setStanding(null) }))`, or return `null` from the request when landed | A | R |
| 3.4 | `move/moving.tsx:241-244` request accessor returns a fresh object per run; `aimed` is `equals`-guarded (`:184-191`, correct) but `standing` is reference-equal and the refound effect mints `{...held, place: moved}` (`:224`) whenever the row's drawn place changes | Value-identical request → teardown + blank: `moved` holds (`:258-266`), but `refusals` (`:273-281`) reads `answer()` → `undefined` → empty map → every dimmed row un-dims for a round trip, then re-dims | Memo the request with `equals` on `(record, to)`, ignoring `place` | A | R |
| 3.5 | `filter/asking.ts:293-300` (`Ask.at`) + `reading.tsx:20-21` | `asking` includes the frame counter in `sameAsk` and sits **outside** the 200 ms debounce (only the text is debounced), so every page frame fires a whole-vault `search.matching` RPC while a filter is on — a bulk op of N edits is N sequential searches; `createResource` drops stale *results* (verified: `sameAsk` + Solid's `pr === p`) but cannot cancel in-flight calls. Then `:338-340` builds a fresh `Map` per answer even when the match set is unchanged → `narrowing.ts:565-586` `selected` → `drawn` re-runs `narrowed()` → a second full prune pass per frame | Coalesce `at` per microtask/rAF, or re-ask only when the page's row set changed; `equals` on `matched` comparing ids + `matched` field | A/B | R |
| 3.6 | `reading.tsx:21` `answer.updated?.(() => moved(c => c + 1))` | Registering any handler makes kolu's `createUpdatedTracker.noteFrame` (`createSubscription.ts:306+`) run `framesEqual(prev, next)` — a deep structural walk of the whole page — **and** `structuredClone(prev)` + `structuredClone(next)` on every frame; the payload is discarded. Two deep clones of a 100 kB page per keystroke, for an integer | Count frames with a cheap signal (a store version, or a kolu counter that does not clone) | B | R |
| 3.7 | `document/documents.tsx:114,147` `wanted = createMemo(() => [...askers().keys()])` (no `equals`) | A second asker on an already-held path (count 1→2) produces a new array → `useCollection`'s `keys` memo notifies → `mapArray` re-diffs and every `read()` accessor re-runs (no refetch; string memos downstream stop it) | `equals` comparing key arrays | B | R |

### 3.4 Smaller items

| # | Where | Effect | Fix | Sev | Ver |
|---|---|---|---|---|---|
| 4.1 | `connection/Offline.tsx:142,165-170` `frozen` is a plain function; the effect tracks the whole `props.readout` | The keydown swallower is unregistered and re-registered on every readout change while `connecting`/`reconnecting` (attempt counts) | `createMemo(() => !reachable(props.readout))` | B | R |
| 4.2 | `directory.ts:270-278` `faces`/`broken` mint a fresh array / `Map` per run | Paths are absorbed by `served.tsx:69-73`'s `equals`, but `useFaces()` readers and every `<File>` row's `broken.has` (`Sidebar.tsx:510,516`) re-evaluate on any head change (booleans; no DOM churn; rare trigger) | `equals` on `broken` comparing key sets | B | R |
| 4.3 | `complete/completing.tsx:49-52` `trigger` memo without `equals` (`triggerIn` returns a fresh object) | `choices`, `failure`, `showing`, `kind` and both question thunks re-run on every caret move (click/arrow/`onSelect` → `readCaret`, `RowEditor.tsx:59-61`) even when the trigger is identical; no re-query (downstream string equals dedupe) | `equals` on `(kind, from, query, sigil)` | B | R |
| 4.4 | `chat/Panel.tsx:178,215` `createEffect(() => sampleLastAgent(chat))` + `chat/last.ts:35-47` | Effect-as-derivation that reads `.kind/.seq/.text` of **every** agent row → subscribed to every row's `text`, so each streamed token of any row re-runs an O(rows) loop to set a module signal | Memo the last agent key off `chat.rows()` (membership) and read only that row's `text` | B | R |
| 4.5 | `palette/Palette.tsx:261-292` `items` | With `query === ""`, `listing()` is true, so every pins frame, every `router.route()` change and every blank/refill of `props.names` (twice per navigation via 3.1) rebuilds the list for a modal nobody sees; `pinnedAt` re-parses the whole shelf each time (`pins/pins.ts:190-193`). Only `opRows` is gated on `paletteOpen()` | Early-return `[]` when `!paletteOpen()` | B | R |
| 4.6 | `palette/Palette.tsx:783` `chosen() && index() === cursor.at()` | `cursor.at()` reads `items().length` and `wanted`, so every row re-evaluates on every list/cursor change | `createSelector(cursor.at)` | B | R |
| 4.7 | `search/Shortlist.tsx:32-34` `createEffect(() => props.refusing?.asked?.(hits()))` → `move/MovePicker.tsx:128` `setAimed` → `moving.tsx:272` resource | A derivation expressed as effect → parent signal → resource (works — `aimed` has `equals` — but it is the shape that hides 3.4) | Hand `hits` up as an accessor; derive `aimed` with a memo | B | R |
| 4.8 | `edit/editing.tsx:105-112, 136-140` + `edit/order.ts` | `follow` reads `page.rows()` + `page.collapsed()` and `flatten`s the whole visible tree per frame while a draft is open; `row()` and `neighbour` flatten again per call (keystrokes do not trigger it — `where` has field-wise `equals`, `draft` is untracked — frames do) | One per-frame memo `Map<key, Row>` shared by the three | B | R |
| 4.9 | `document/faces.tsx:139-154` landing effect tracks `text()` | A file rewritten on disk (an agent write, `git pull`) while `router.landing()` still names this pane re-runs `scrollIntoView`, yanking a reader who had scrolled away back to the heading | `on(() => [router.landing(), markdownReady()], …)` with `text()` untracked, or clear `landing` after the first successful scroll | C | R |
| 4.10 | `format/src/derive.ts:1349` `Row.key = ${parentKey}/${id}` + `editing.tsx:105-112` `follow` → `refound` + `Tree.tsx:605` `<Match when={typing("title")}>` | Indent/outdent (`move in/out`) changes the row's key → old row's editor Match flips false, new row's flips true → a new `TitleEditor` whose `opening` path (`RowEditor.tsx:149-156`) uses `props.caret ?? field.value.length`, and a `kept` draft has no `caret` (`editing.tsx:162`) → caret jumps to the end of the title on every indent while typing. `up`/`down` keep the key | Carry the caret in the draft for structural ops (as `split`/`merge` do via `opening(done, caret)`), or key the editor on the node id | C | r |
| 4.11 | `edit/editing.tsx:97-104, 147-152, 313` `settling = true` before `send`, cleared only by the next frame or a refused send | A redraw verb the server accepts but that produces no frame for this page leaves `settling` true and `blur` ignored until some unrelated frame — a hazard that rests on the server's no-frame-for-a-no-op behaviour | Clear on the procedure's reply, not on the next frame | C | r |
| 4.12 | `settled.ts:52` + `search/Shortlist.tsx:77-78` / `complete/completing.tsx:144-148` `take` | The previous answer is held while a new question settles (by design: rows hold still) but `take` does not check `answering()`, so Enter within 200 ms + RTT of typing picks the **previous** query's row | Gate `take` on `answering() !== null`, or dim stale rows | C | R |
| 4.13 | `chat/declared.ts:186, 255, 258` | The failure slot is last-to-settle-wins: a late failure from an older batch can overwrite a newer success's clear (acknowledged in the comment at `:177-183`). Per-message `known` maps are safe | Tag the slot with the batch that set it | C | R |

### 3.5 Upstream (kolu)

| # | Where | What | Fix |
|---|---|---|---|
| 5.1 | `@kolu/surface/src/solid/writeValue.ts` | `reconcile(next, { key: null })` without `merge` replaces every array element per frame (Fact B) — the root of §3.2 and of 2.11's O(rows)-per-frame | Let the stream/collection declare an array key (`key: "key"` for rows; `"id"` for names, crumbs, refs) and pass `merge: true` for arrays whose elements have none |
| 5.2 | `@kolu/surface/src/solid/createSubscription.ts:306+` `createUpdatedTracker.noteFrame` | Two `structuredClone`s + a deep `framesEqual` of every frame the moment any `updated` handler is registered (3.6) | A tracker mode that counts without cloning |
| 5.3 | `@kolu/surface/src/solid/createReactiveSubscription.ts` | Fact A's clause (a), which is the framework diverging from its own docstring: the header says the subscription re-establishes "whenever the input **changes**", and the implementation is `on(inputFn, …)`, which fires when the input NOTIFIES. Every consumer therefore has to re-impose the equality by hand, and each of them writes the same paragraph explaining why (`PageView.tsx`, `dates.ts`'s `createOwed`, `moving.tsx`, and — found by PR 3 — `document/Hypertext.tsx`) | Compare the input where the schema is: the binding loop in `surfaceClient.ts` (`for (const [key] of Object.entries(spec.streams))`) has `inputSchema` in hand, so `Schema.toEquivalence(…)` lifted over `null` is the right equality for every stream of every surface with no app knowledge. After it lands, `moving.tsx`'s `request` memo and its `null`-lifting go, and `createOwed`'s "hand me a memo" contract stops being the caller's to keep |

After the kolu change lands, bump the npins pin here and delete whatever client-side `equals` 2.10 needed.

## 4. What is already right — do not touch

The Sidebar component itself is textbook: `<Key by="key">`, `createSelector`, a tree memo over a membership-equal path list (`served.tsx`), `const outline = props.row.of` captured once is safe because the key encodes the path. `PageView`'s request chain — `route` (by reference; `panesOf` preserves `layout.route` identity across focus/resize) → `opened` (`equals: samePage`) → `request` (`equals: samePageRequest`) → `createReading` — never re-subscribes on `?q=`, heading-only, focus or resize changes. `page`/`allDrawn`/`shownDrawn` are frame-stable (Fact B keeps `shows`/`rows`/`zoomed` identity); `drawnBy`'s `NOTHING_DRAWN` singleton and `narrowing.drawn` returning `source.visible()` identity when nothing is selected behave as intended; `counts` has a by-value `equals`. `Zoom`/`NodePage` is not remounted per frame (non-keyed `<Show>`/`<Match>` over identity-stable objects; heading fields are fine-grained store reads). Every `Branch` `<Show>`/`<Match>` is truthiness-keyed, so a new row object updates bindings without recreating pickers, editors or bodies. `createSettled` (equals on both `wanted` and `asked`, `untrack`ed `current`, `mutate(undefined)` on clear), `createStamped`, `createOwed` + `markOf` held by `unchanged`, `askedOn` as a string memo, `month` as a string memo, the transcript's `<For>` over string keys with lazy `entry(key)()`, `previousOf` waking only on order change, per-message id marking (`declared.ts` filters `known`/`asking`, `GATHER_MS=0` batches, marks applied after Markdown's render effect), `chips.ts`'s `live` guard, fold re-filing's 750 ms debounce + `latest` counter + no-op write, `connectionReadout` under `sameReadout`, `DocumentPage` keyed on file, `faces.tsx` gated on a boolean, `useDocument` re-registering only on a path change, `NodeRefs`/`DayGroups`/`Spine`/`TrashPage` `<Key>`s, `Shortlist`/`Completions` `<Index>`, `createResource` stale-drop on every search door, `MenuSaid`'s `sameAt`, `undoing.ts`'s serial queue, `commit`'s `held === current` identity check. No destructured props anywhere in the client.

## 5. The PRs

The law is the one `vault-in-browser.md` §6 states and `HACKING.md` repeats: every PR self-contained (deletes what it replaces, ships nothing unused), every fix with a test that reproduces it, CI green through odu. PR 1 first — it is the reported symptom; the rest are independent of each other and of PR 1.

1. **The chrome reads the route, and a navigation swaps the page** — §3.1 entire (1.1–1.8). One diff: `App.tsx` derives `openFile`/`openDay`/`names`/`zoomed` from the route and holds the reading-only parts across the blank; `PageView` holds the last `shows` and gates the FilterBar on the route; `asking.ts` stops clearing on the blank; undo clears on the held file. **Tests:** the DOM-identity probe of §6 becomes a step — `Then the sidebar did not remount` (tag before, count after) and `Then the "notes" folder stayed open` — in a navigation feature over `@corpus:good` (it has `Daily/` and `notes/`); a calendar scenario that clicks a second day of a non-current month and asserts the month header never changed; an undo scenario that zooms into a node of the open outline and still has its ⌘Z; a `?q=` pin scenario that asserts the page never drew an un-narrowed row (`the page has not reloaded` exists in `app_steps.ts:73`; the others are new).
2. **Nine `<For>`s learn their key** — §3.2 2.1–2.9, plus 2.10's `equals` on `namesIn`. Mechanical; one PR, or one per area if the reviewers prefer. **Tests:** a browsertest per site in the style of `fold/refiling.browsertest.ts` — render, replay an identical frame through the store, assert the element identities survived — or the DOM-identity step over a live edit.
3. **Three `equals` and a reset** — 3.1 (Hypertext landing), 3.2 (composer `subjects`), 3.3 + 3.4 (moving leak and request identity), and 4.7 with them since it is the same module. **Tests:** two-pane HTML-preview scenario asserting the iframe's `src` was set once while the other pane navigates to a heading; a composer scenario counting `nodes.named` calls over a typed word (the fake ACP agent and the wire's call log are there for this); a move scenario that lands a move, waits out the said-line, and asserts no `moving` subscription is open (`packages/tests/wire.ts` can count).
4. **The per-frame tax** — 3.5 (coalesce the re-ask), 3.6 (frame counter without clones; may need 5.2 first — if so, count frames with a store version on this side and note it), 3.7, 4.1–4.6, 4.8. **Tests:** `packages/tests/wire.ts` measures calls per frame before/after; unit tests for the `equals` functions.
5. **The C's** — 4.9–4.13. Small, independent; each with the scenario its row describes.
6. **Upstream** — §3.5, in the kolu repo; then the npins bump here and the deletion of whatever 2.10/3.6 had to work around.

## 6. Reproducing it

Serve from the working tree without `just run`'s watchers (so Playwright sees a stable bundle):

```sh
just install                                              # hydrates @kolu/* — stale node_modules fail at boot
S=/some/scratch; cp -r packages/tests/fixtures/good $S/vault
printf '# Second\n' > $S/vault/notes/second.md            # a second file in one folder
nix develop .#e2e --accept-flake-config -c bun packages/web/src/build.ts $S/dist
OLAI_DIST_DIR=$S/dist OLAI_ACP_AGENT="" OLAI_LOG=logfmt XDG_CACHE_HOME=$S/state XDG_STATE_HOME=$S/state \
  nix develop .#e2e --accept-flake-config -c bun packages/server/src/main.ts web $S/vault --host 127.0.0.1 --port 47123 --no-commit
```

The probe (run with `bun` inside the same shell from `packages/tests/` so `playwright` resolves; it is the shape the e2e step in PR 1 should take):

```ts
import { chromium } from "playwright"
const [from, to] = ["/notes/palette.md", "/notes/second.md"]
const page = await (await chromium.launch()).newPage({ viewport: { width: 1400, height: 900 } })
await page.goto("http://127.0.0.1:47123" + from)
await page.waitForSelector(`a[href="${to}"]`)
await page.waitForFunction(() => !document.querySelector("main")?.textContent?.includes("Reading…"))
await page.evaluate(() => {
  const side = document.querySelector('[data-testid="sidebar"]')!
  let i = 0
  side.querySelectorAll("*").forEach((el) => ((el as any).__tag = ++i))
  ;(window as any).__tagged = i
  const log: unknown[] = []; (window as any).__log = log
  const desc = (n: Node) => n instanceof Element
    ? `${n.tagName.toLowerCase()}[${n.getAttribute("data-testid") ?? ""}](${n.getAttribute("data-path") ?? n.getAttribute("href") ?? ""})#${(n as any).__tag ?? "new"}`
    : `text(${JSON.stringify((n.textContent ?? "").slice(0, 30))})`
  new MutationObserver((recs) => {
    for (const r of recs) log.push(r.type === "childList"
      ? { t: "childList", target: desc(r.target), added: [...r.addedNodes].map(desc), removed: [...r.removedNodes].map(desc) }
      : { t: "attr", target: desc(r.target), attr: r.attributeName, old: r.oldValue, now: (r.target as Element).getAttribute(r.attributeName!) })
  }).observe(side, { subtree: true, childList: true, attributes: true, attributeOldValue: true })
})
await page.click(`a[href="${to}"]`)
await page.waitForFunction((to) => location.pathname === to && !document.querySelector("main")?.textContent?.includes("Reading…"), to)
await page.waitForTimeout(600)
console.log(await page.evaluate(() => {
  const side = document.querySelector('[data-testid="sidebar"]')!
  const still = new Set<number>()
  side.querySelectorAll("*").forEach((el) => { const t = (el as any).__tag; if (t) still.add(t) })
  const total = (window as any).__tagged as number
  let gone = 0; for (let i = 1; i <= total; i++) if (!still.has(i)) gone++
  return { total, gone, log: (window as any).__log }
}))
```

Expected today: `gone: 16` with the `notes` `<ul>` removed and re-added around a `data-collapsed` round trip. Expected after PR 1: `gone: 0`, and the only sidebar mutations are `aria-current` leaving one link and arriving on the other in the same frame.

The Fact B replay, for PR 2's browsertests: build a store with `createStore({ v: undefined })`, write a frame with `writeWrappedValue`, subscribe to `store.v.shows.rows[0].node.title` and `store.v.shows.rows[$TRACK]` in a `createRoot`, write a structurally identical frame, count the notifications — 1 each today; 0 once a key is declared upstream.

## 7. What this does not claim

The audit covered the 107 client files the ten PRs touched plus what they import; it did not re-audit the server, `packages/format`, or files the flip left alone. Items marked **r** were not run. The auditors were four parallel readers with the same brief; findings that two of them reached independently (1.4, 1.7, 2.10, 3.5) are reported once. Nothing here changes the ruling of `vault-in-browser.md`: the browser still holds only the current page; what changes is that the chrome stops *asking the page* for what the address already says, and that a page arriving replaces the last one rather than a blank.
