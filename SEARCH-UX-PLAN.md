# Search UX plan

Status: **approved by the human, 2026-09-10.** Brief for the implementer. Written 2026-09-10 on the `search-improvements` branch, after reading `docs/search.md`, `packages/format/src/filter.ts`, `packages/format/src/searching.ts`, `packages/plugins/search/src/matcher.ts` and the row components under `packages/plugins/search/src/contracts/ui/`. The companion artifact ("Search Says What It Found") shows the same four items as pictures.

Four items, approved as written here. They are four commits in ONE PR, in the order below, each commit carrying its own e2e. The PR is opened as a draft; the orchestrator runs CI; the human merges. Nothing is merged by an agent. Nothing here changes what a query SELECTS. The differential tests (`table.test.ts`, `matcher.index.test.ts`, the scope harness) must keep passing untouched; if one has to change, the item has drifted and should stop.

Rulings from the human, 2026-09-10, that shaped this version:
- The second line of every row names the file, then the path from the file down. No glyph, no filename column, no kind word, no excerpt. The extension is the kind.
- No results page. A capped list is narrowed by typing more or by picking a kind; that is the drill-down.
- The kind selector has three segments, All / Nodes / Files, because "a thing inside" versus "a file" is the distinction a person already holds.
- File kinds stay a static table in core; no plugin registers a kind into search (see "Kinds are a static contract").

## Ground rules that hold for every item

- **One declaration.** Every new field on a hit is declared once in `@olai/format`'s `searching.ts`, produced by `matcher.ts`, carried by `@olai/surface`, drawn by the row, and read by `search_nodes`. Never a browser-side re-derivation of something the server already knows.
- **Cordis.** See "Cordis obligations" at the end. The one-line version: every new live value has a named owner whose departure ends it, crosses a package boundary only as a declared service or a field of one, and is released in the same activation that acquired it. A serve without `olai-plugin-search` still answers every door with the `NO_SEARCH` refusal. The PR description names the ownership boundaries it adds or moves.
- **Absence is the format's rule.** A new optional field is omitted, never `null` or empty, when there is nothing to say.
- **Docs in the same PR.** `docs/search.md` sections "What a result row looks like", "Documents, by name" and the door list. `docs/e2e-coverage.md`'s "Search and filtering" row. Only touch `website/` if a screenshot of the palette there is now wrong.
- **E2E first.** Each item lists the scenarios it must add under `packages/tests/features/`. Run `just e2e-fast-remote` on the working tree before opening the one PR as a draft; the orchestrator runs CI; the human merges.

## 1. The place line names the file, then the path

*(Ruled 2026-09-10. A filename column and a per-row glyph were each proposed and withdrawn; the second line already exists on every row, so it says the file.)*

**Problem.** A search answers with nodes and files in one ranked list. A document row wears a glyph and shows its path; a node row shows its ancestor crumbs and names its file only at the top level. So the kind of a row is told by a glyph on some rows and by nothing on others, and the file a node lives in is usually not on screen.

**Contract change.** None. A node hit carries `file` and `path`; a document hit carries `at.path`; item 3's outline hit carries its path.

**Row change** (`contracts/ui/place.ts`, `row.ts`, `Result.tsx`):

- **No glyph on any row.** `Result.tsx`'s `of` prop and the `Glyph` it draws go, and so does the `of` field on `HitRow` (`row.ts`) and on the palette's item (`palette/items.ts`). `Result.tsx` stops importing `olai-plugin-files/icons`. The extension on the second line is the kind.
- **The second line starts with the file, for every kind of row.** A document: its path as today (`notes/kitchen.md`). An outline hit: its path (`Kitchen.olai`). A node: the outline it is written in, as its path exactly as a document's is shown (`Home.olai`, or `work/Home.olai`), then its ancestors **from the file down** (`Home.olai · Kitchen · Cabinets`). A top-level node shows the file alone.
- **Order changes from nearest-first to file-down**, and that is deliberate: with a file in front the line reads as a path, and nearest-first after a filename reads as nonsense. Update the header of `place.ts` and `docs/search.md`'s "What a result row looks like", which argue nearest-first; also "Documents, by name", which says a file row is drawn with the sidebar's glyph; and `docs/chat.md` where it describes the `@` list's node rows.
- **Truncation keeps both ends.** The old order existed so a cut line kept the nearest crumb. Keep that promise structurally: the line is three spans in a flex row, the file (`shrink-0`), the middle crumbs (`min-w-0 truncate`), and the nearest crumb (`shrink-0`, capped at a width so a long title cannot starve the file). A short line reads whole; a long one reads `Home.olai · Kitchen · Bathroom · … · Cabinets`. `place.ts` returns the three parts rather than one joined string, and `Result.tsx` draws them. The `((` widget and the chat `@` list call `nodePlace` too; they draw the three parts the same way.
- Tags in crumbs keep their pills, as today.
- `Shortlist.tsx` (edge panel, move picker, `((`) gets the same line for free through `hitRow`. A mover seeing which outline a destination is in is a gain, not noise.

**Agent side.** Unchanged. `path` on the wire stays root-first as it is.

**E2E.** New `search_place_names_file.feature`:
1. A query matching a nested node, a top-level node, a `.md` and (after item 3) an `.olai`: each palette row's second line starts with its file; the top-level node shows the file alone; no row shows a glyph.
2. A node five levels deep with long titles: the second line shows the file at the start and the nearest ancestor at the end, with an ellipsis between.
3. The header box and the move picker draw the same line.
4. Phone width: the same, through the palette.

## 2. A document hit opens on the match

**Problem.** A node hit carries `file:line` and opens on the node. A body match on a long `.md` opens the page at the top with no idea where the word was.

**Contract change** (`@olai/format` `searching.ts`), on `DocumentHit` only:

```ts
/** The 1-based line of the FILE where the strongest word match sits. ABSENT
 *  when `matched` is absent or is `title`, `path` or `tag`, and on every file
 *  the set keeps no body for. A place to go, not text: nothing is written
 *  against it. */
line: Schema.optionalKey(Schema.Int)
```

Produced in `matcher.ts` after the cap, so only the drawn hits pay for it, found by the same case fold the matcher used (`documentHay`), never a second matcher. The prose is matched after frontmatter is stripped, so the line is re-offset by the frontmatter's line count to be a line of the file.

**Route.** `olai-plugin-navigation`'s `atFile` gains an optional fragment, `#L<line>`, spelled once in `routes.ts` beside `atNode`. The document page (find the `.md` page by the `markdown-ui` consumer under `packages/plugins/markdown/src/browser`) reads the fragment on mount and on navigation, scrolls the rendered block containing that source line into view, and lights the query's needles inside that block using `markdown-ui`'s existing highlight walk (the same one the filtered page uses, so a `#tag` or a code span lights the same way). The needles come from the address's `?q=`, which the row sets when it opens the hit; nothing is remembered in the browser.

**Rule for the fragment.** The line is a SOURCE line; the renderer already keeps a source map for edit-in-place. If a line maps to no block (a blank line, a fence marker), scroll to the nearest block before it. If the file changed and the line is past the end, open at the top and say nothing. The address is a link somebody can send, so it must not throw on a stale line.

**Row.** `row.ts` builds the route from `hit.at.path` and `hit.line`. A document hit with no `line` opens at the top exactly as today.

**E2E.** New `document_hit_opens.feature`:
1. A 200-line `.md` with the word at line 140: Enter on the hit opens the page scrolled so that block is in the viewport, with the word lit.
2. Back returns to the page you searched from.
3. A stale link (`#L999`) opens the top with no error.
4. Phone width: same, through the palette.

## 3. A file's name matches whatever the file is

**Problem.** `bodiedIn` excludes outlines, so an `.olai` file's own name is never a hit. `Home` finds nothing unless a node carries that word. A `.md` matches on its path; an `.olai` does not; the sidebar tree has both. The human's ruling: a filename matches whether it is `.md` or `.olai`.

**Contract** (`searching.ts`): a third arm.

```ts
export const OutlineHit = Schema.Struct({
  at: AtOutline,               // new address kind if `address.ts` lacks one: the file path
  title: Schema.String,        // the file's display name, the one the sidebar uses
  matched: Schema.optionalKey(Schema.Literals(["title", "path"])),
})
export const SearchHit = Schema.Union([NodeHit, DocumentHit, OutlineHit])
```

An outline is matched on two fields only, its name and its path, with `FIELD_WEIGHT.title` and `FIELD_WEIGHT.id`. It has no tags, no body, no frontmatter and no marks: every operator selects no outline, negations pass it through, `prop:` selects none. A `.olai` under `_olai/` (Trash, Pins, Properties) is never a hit, since those are the app's own files. Scoped queries select no outlines.

**Matcher.** `matchingOutlines` in `filter.ts` beside `matchingDocuments`, walked over `set.documents.filter(d => d.kind === "outline")`. Ranked in `rankedTogether` on the same scale. The index in `table.ts` may skip outlines entirely; there are hundreds at most and two short strings each. The differential tests must include the new arm.

**Row.** The second line is the file's path (`Kitchen.olai`, or `work/Q4.olai`). Route is `atFile(path)`. `kind: node` requests must exclude outlines. The request's literal set becomes `node | document | outline | file`, where `file` selects documents AND outlines together; `document` keeps today's meaning for agents already sending it. Item 4's selector sends `file`.

**E2E.** New `outline_by_name.feature`: `Home` finds `Home.olai` above a node whose note says home; Enter opens the outline; `_olai/Pins.olai` is never a hit; `kind: node` from an agent excludes it.

## 4. Kind selector

**Problem.** `kind` exists on the request for agents and has no spelling for a person. A node-only searcher should go straight there. And with no results page, narrowing is how a reader gets past the cap of eight: type more, or pick a kind.

**Design.** A segmented control with three segments: `All` `Nodes` `Files`. Nodes are the rows inside outlines. Files are everything that is a file in the vault: `.md`, `.olai` (item 3), and the shown kinds (`.html`, `.csv`, images, `.pdf`). `Files` sends `kind: file`. Drawn under the box in the palette and in the header panel. It sets `kind` on the REQUEST, so the cap applies before the answer and the count is about what was asked. There is deliberately no grammar token for it: one spelling, and it is the request field agents already have. The `Search` provider's `kind` argument becomes an `Accessor` so a change re-asks without retyping.

**Sticky.** The pick is session state: one signal created inside a new `kind` component of the search plugin's browser activation and offered as `search.kind`. The palette and the header box read it through a face the component contributes into a `search.box.below` location, so neither box needs the component to be ready. Reset on page load and on plugin rebuild. Not a vault setting: it is a hand position, not a preference. Ownership details are in "Cordis obligations" below.

**Keys.** Tab cycles the segments while the caret is in the box; the palette and the header box claim Tab through `listKey` so the row editor's own Tab is untouched. Each segment shows its count as a small mono number when the answer has one: `Nodes 14`. That is `total` per kind, which means the server answers `totals: { node, file }` beside `total` when asked with no kind; add that optional field to `SearchAnswer` in `searching.ts`. When a kind is picked only that kind's count is known and the other segment draws no number.

**Drill-down, not a page.** The count line stays `8 of 20 matches` and stays plain text. The way past it is the box and the selector. Do not add a "see all" link, a results route, or a larger limit at the listing doors.

**Honesty rule.** The selector never hides a refusal or the count line. `Files` picked with `is:done` in the box answers "0 matches" and the refusal if any, never an empty panel.

**Pickers are excluded.** The edge panel, move picker, `((` and the chat `@` list are node-only by construction and draw no selector.

**E2E.** New `search_kind_selector.feature`: pick Nodes and a document that would rank first disappears while the count changes; the pick survives closing and reopening the palette; Tab cycles; a plugin rebuild resets it to All; the phone palette shows the control; `Files` with `is:done` shows zero and no empty panel.

## Commit order and sizing

| commit | touches | size |
|---|---|---|
| 1 place line names the file | place, row, Result, palette items, docs | S |
| 2 open on match | format (`line`), matcher, navigation routes, markdown page, row | M |
| 3 outline hits | format (new arm), matcher, table tests, row | M |
| 4 kind selector | search plugin browser, contracts/reading, searching (totals), palette, header | M |

Commit 1 comes first because it is small and every later mockup assumes the place line. All four commits are in the one PR.

## Cordis obligations

`docs/architecture/cordis.md` is the rule; this section is that rule applied to these four items. For each: who owns the new value or work, who may depend on it, what leaves when the owner leaves, and what a consumer sees while the owner is absent. A reviewer should be able to check every row of these tables against the one PR.

### The existing shape, which nothing here may weaken

- `olai-plugin-search`'s browser activation OWNS the search reading. It offers it as `search.readings` (`Offers.own("readings", …)` in `browser.tsx`) and installs a holder (`holdReading`) released by the same `acquireRelease`. The palette, the header box, the pickers and the chat `@` list acquire the reading through that offer or through a component that declared it. The reading's own subscriptions (one per open query) belong to the component that opened them and end when its box closes or its query clears.
- The server-side matcher and its index are opened on the search plugin's own scope (`server.ts`) and registered into the vault through `VaultViews` (provider registers into consumer); `@olai/ops`' `Search` door is core's and answers `NO_SEARCH` when no row stands behind it.
- Core (`@olai/format`, `@olai/surface`, `@olai/ops`) holds only static contracts: schemas, the matcher's pure functions, the `search.nodes` procedure. That stays true: nothing below adds a live value to a core package.

### Kinds are a static contract, not a live value (question from the human, 2026-09-10)

Asked: do we already have a plugin per kind that could provide its kind to the search plugin, so the selector's segments are contributed rather than hard-coded?

Answer: no, and the plan deliberately does not introduce one.

- **File kinds are a closed table in core.** `@olai/format`'s `kinds.ts` names the six kinds (`outline`, `document`, `hypertext`, `csv`, `image`, `pdf`) and its header rules that a new kind is one entry there, after which the type checker names every drawing that owes it. The outlines, markdown and files plugins DRAW those kinds; none of them owns one. "The registry decides; the surfaces draw."
- **Plugin-registered kinds exist, but for properties.** `Kinds.register` in `@olai/plugin-api` is how kolu contributes `kolu-terminal` as a PROPERTY kind. That is the vocabulary `prop:` reads (`KindVocabulary`, handed into the matcher). It is not the file-kind axis the selector picks on.
- **Matching is one pure function per arm, in core.** `matching` and `matchingDocuments` (and item 3's `matchingOutlines`) live in `filter.ts` so the agent, the filter and the person cannot drift. The index table in `table.ts` indexes the arms in one place. The search plugin registers the WHOLE matcher into the vault through `VaultViews`, which is the one live boundary search already has.
- **Why static is the Cordis-correct answer here.** Cordis asks who owns a value and what happens when the owner leaves. Nothing can leave: no row can add or remove a file kind at runtime, and disabling the markdown plugin does not take `.md` files out of the set (the set is core's). A registration service for something that never changes would declare a dependency on an owner that never departs, which is a service locator wearing a broker's clothes. `docs/architecture/cordis.md`: "A runtime import is not automatically a lifecycle dependency."
- **So the selector reads the table.** The segments are `All`, `Nodes` (kinds whose `holds` is `nodes`) and `Files` (every other kind), derived from `kinds.ts` at build time, not registered.
- **The day this changes.** If a plugin ever owns a file kind, the set's assembly becomes registration-driven, the matcher becomes a composition of arms, the index takes arms, and "what a query finds" starts depending on enabled rows. That is the day to add a `search.arms` registration modelled on `VaultViews`, with the differential tests run per composition. It is not this plan.

### Per item

| item | new live value or work | owner | how consumers reach it | on owner departure | while absent |
|---|---|---|---|---|---|
| 1 place line | none; read off `hit.file`, `hit.path` and `hit.at.path`, which the answer already carries | the search reading (unchanged) | rides the hit through `search.readings` | leaves with the answer | not applicable |
| 2 `line` on a document hit | none live; a pure field derived per answer inside the matcher | the search reading (unchanged) | rides the hit | leaves with the answer | the row opens the file at the top |
| 2 open on match | the scroll-and-light of a document page on arrival | the MARKDOWN PAGE's activation, not the search plugin | the page reads the address (`#L` and `?q=`) it was given; it acquires nothing from search | the page's own `onCleanup` removes the highlight and any scroll observer | a `#L` fragment with no page code to read it is inert; the file opens at the top |
| 3 outline hits | none live; a third matcher arm | the search reading | as item 1 | as item 1 | as item 1 |
| 4 kind pick | the session's current kind, one signal | a NEW component of `olai-plugin-search`'s browser activation, `kind`, offered as `search.kind` (`{ pick: Accessor<Kind>, set }`) | a face the component contributes into `search.box.below`, a location the search plugin owns and both boxes draw | the signal is disposed with the component; the face is withdrawn through the location's own release; the boxes go on asking with no kind | the selector is not drawn and the box asks with no kind, which is today's behaviour |
| 4 per-kind totals | none live; an optional `totals` field on `SearchAnswer` | the server matcher | rides the answer | with the answer | the segment draws no number |

### Rules the tables imply

1. **Choose the owner by who should end it.** The kind pick belongs to the search plugin's activation, not to the palette (which navigation owns) and not to a module variable in `@olai/web`. The document page's highlight belongs to that page, not to the search plugin; the search plugin must not reach into a page it does not own to scroll it. The address is the only thing that crosses that boundary, and an address is data.
2. **No new service locator.** `search.kind` is a narrow, declared service with one owner and a stated absence behaviour. It is not a `current(anyKey)` hatch, and it is acquired only by components that list it in `needs`. A face that wants the pick without declaring it is a review failure.
3. **Optional availability is designed, not defaulted.** The palette and header box work with the `kind` component absent. The selector is a face contributed by the `kind` component into a `search.box.below` location, owned by the search plugin and registered the way `app.header` is, rather than the boxes needing the component. A box does not wait on an optional component to become ready, and its reported readiness does not change.
4. **Subscriptions have owners.** A kind change RE-ASKS the same subscription the box already holds; it must not open a second one and leak the first. Closing the box ends the subscription even if the answer is in flight, exactly as today.
5. **Stopping order is the bridge's, not ours.** Nothing here adds a finalizer that assumes it runs after a dependent's. The `kind` component's signal and face are both released by `acquireRelease` on its scope, and the bridge orders revocation before resource close.
6. **Reconnection.** The reading already re-asks an open query when the wire returns. The kind pick is browser state that survives a reconnect unchanged (it never left the tab), so after the wire comes back the boxes ask with the same kind. A plugin REBUILD disposes the `kind` component, so the pick resets to All; that is stated in the docs, and item 4's e2e asserts it rather than assuming the old value.
7. **Two apps, two picks.** `holdReading` is per browser app. The kind signal is created inside the activation, once per app, never at module level, so two mounted apps do not share a hand position.
8. **Static imports stay static.** `olai-plugin-navigation/routes`' `atFile` gaining a fragment is a pure function change. `@olai/format`'s `kinds.ts` is an inert lookup. Neither becomes a lifecycle dependency by being imported.
9. **Say what moved.** The PR description lists the new component (`kind`), the new service key (`search.kind`) and the new location (`search.box.below`), with their owner and their absence behaviour, in the words of these tables.

## Out of scope, ruled by the human

A results page (drill down by narrowing instead), ranking changes, operator completion in the box, recent items on an empty palette, and a per-plugin kind registration. Fuzzy or semantic matching stays parked per `docs/search.md`.
