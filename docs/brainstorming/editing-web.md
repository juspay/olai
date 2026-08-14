# Human editing in the web UI

Status: SHIPPED as `self-edit` (keyboard editing) — what is below is the research and the decisions it was built from, kept because the editor-growth items are built from the same page. Reference model researched 2026-08-09: Workflowy, from its official help/blog docs (a few details are community-sourced; flagged). A second, exhaustive pass over Workflowy's modification inventory — hotkeys, slash commands, bullet types, and the bullet/context menu — was made 2026-08-12 and lives in its own section at the end; it is the checklist the editor-growth items are measured against.

## What shipped, and the three things the build decided

The resolved plan below landed as written — same ops layer, no optimistic UI, structural keys as immediate ops, text buffered in a draft cell. Three questions it did not answer came up while building, and the answers are worth keeping:

- **A new row is a draft, not a blank node.** The ops layer refuses a node without a title and is right to, so `Enter` opens an editor where the row will go and the `add` lands the moment it has text (`Enter`, blur, or idle). An abandoned empty row writes nothing — which is also what stops `Enter Enter Enter` from filling an outline with blank bullets and a git log with `capture: `.
- **The wire verbs are INTENTS, not ops requests.** `Tab` sends "indent this", not "reparent under the node above, placed last": the neighbours a placement is computed from are facts about the snapshot, so they are read on the server, against the revision the write is judged against, rather than computed in a tab from a tree some frames old. Same for `Ctrl+Enter`, which sends "toggle" and lets the server read the stored mark. That also keeps the browser's closed list narrower than the agent's (no `create`, `archive`, `see`, `date`, no chosen ids).
- **No optimistic UI costs the CARET, and that is the real work.** A row that indents is redrawn at a new place by a new branch, and a row that reorders has its element moved — both take focus off the input in a browser. So a draft is about a ROW — the record occupying a line, a mirror's own id and not its target's — and it follows that row across the frame, with the editor asking for the caret back once the frame that redrew it has been rendered. What a draft COMMITS is the other id: the node the row SHOWS, so typing in a mirror edits what it stands for while moving one moves the placement. The alternative — echoing the move locally so the row never appears to leave — is exactly the optimistic UI this design is written against.

An `<input>` rather than `contenteditable` for the title (a title is one verbatim line with no markup, so the trade is `#tags` reading unstyled while the caret is in the row) and a textarea for the note, per the plan. Delete stayed out entirely, per the human's 2026-08-11 decision, and it is still out: what `undo` shipped is the un-create — the inverse of an `add` — and a delete key remains that item's to rule on. What `undo` settled is a section of its own below.

Two more things the build settled, both of which started as the obvious shape and were wrong:

- **The wire is ONE union and one procedure**, not one procedure per verb. Five procedures turned out to be five spellings of one list — the wire, a parallel type, a client-side dispatch and a binding each — which is exactly the shape `packages/ops` replaced with `Request` + `run` and says so in its own header. Adding a verb is now an arm and a resolver arm.
- **A write that LANDS can have something to say**, and the keyboard was dropping it. The ops layer's `nudge` (the last task under a parent going done, a branch ticked over unfinished ones) reaches an agent in its tool result; the person who pressed the key is exactly who it is for. It rides back on the same answer and is drawn where a refusal is drawn, toned as advice rather than alarm, and the next keystroke takes it away.

## Settled (carried from the ratified rewrite plan)

- All human edits go through the same ops procedures as the agent — one ops layer (born in the chat item), server-authoritative, no optimistic UI: a write changes the file, the live stream pushes the update.
- The bar is the Workflowy loop: add, check off, reorder, move — keyboard-first.
- Drag-drop, views, command palette are editor-growth, each its own PR.

## Workflowy's model (the distilled facts)

- **Everything edits inline**: click any bullet, cursor lands in its text. No separate edit mode; arrow keys move the text cursor between bullets. (Whether it's `contenteditable` or a custom editor is undocumented.)
- **The core keys**: `Enter` new sibling · `Tab`/`Shift+Tab` indent/outdent · `Alt/Ctrl+Shift+↑↓` move among siblings · `Ctrl/⌘+Enter` complete · `Shift+Enter` add/edit the note under a bullet · `Ctrl/⌘+Shift+Backspace` delete (recoverable from Trash) · `Backspace` at line start merges into the previous bullet · `Ctrl/⌘+Z` undo (redo binding is inconsistently documented).
- **Text niceties**: live markdown recognition while typing (`- [ ]`, headings, code fences), a floating format toolbar on selection, multi-level bulleted paste becomes correctly nested bullets.
- **Structure**: drag-drop moves a node with its whole subtree; multi-select via five gestures (drag-across, modifier-click, shift-click, shift-arrows, double `Ctrl+A`) with bulk complete/move/indent/delete; duplicate auto-tags `#copy`.
- **Mirrors**: created by typing `((` (a search widget to pull in a distant node), or menu / `Alt/⌘+Shift+M`; edits propagate to all placements; "detach" converts back to a copy; rendered with a distinct bullet glyph (community-sourced).
- **Dates**: `!` opens a date picker that accepts natural language ("in three weeks").
- **Completion**: per-item; completing a parent does **not** complete children. A new sibling created under a to-do inherits to-do-ness. Completed items stay visible until toggled hidden.
- **Consistency**: offline-capable, sync-later, and — per a Workflowy team comment — concurrent edits resolve by **last-write-wins**. This is the road we deliberately did not take: olai's store uses optimistic concurrency (`StaleWrite` + semantic-op retry) over git. We can borrow their keybinding surface, not their consistency model.

## Mapping to olai — resolved 2026-08-09

- **Latency model**: structural actions (Enter, Tab, move, done, delete) are immediate ops; *text* edits buffer in a client-local draft cell, committed as one op on blur/Enter/idle. Typing stays local without violating the no-optimistic-UI rule — the draft is presented as an editor, not as committed state. (Per-keystroke ops and optimistic echo were considered and rejected.)
- **Split/merge deferred** to its own editor-growth item: in the first PR, Enter always adds a sibling and Backspace only edits text.
- ~~**Undo deferred** out of the first PR~~ **SHIPPED as `undo`**, and the leading candidate is what it turned out to be: client-side op inverses, "undo *my* last op", concurrent-editor-safe. See below.
- **Desc editing**: `Shift+Enter` opens a plain textarea under the node; rendered markdown returns on blur. Desc is one verbatim string — a textarea is honest, and the draft-cell model applies unchanged.
- **First-PR keybinding set**: Enter (add sibling), Tab/Shift+Tab (indent/outdent), Alt+Shift+↑↓ (move), Ctrl+Enter (toggle done), Shift+Enter (desc), delete. Multi-select, drag-drop, `((` mirror creation, `!` date picker, `#` autocomplete: editor growth. ~~Multi-select and drag-drop~~ **shipped 2026-08-13** — see the section on them below.

## Revised after the human drove it (2026-08-11)

Three bugs and one design change, from the first session with a person's hands
on it. The design change SUPERSEDES the note decision resolved 2026-08-09
below, which is left standing as written because the reason it lost is the
useful part.

- **The note edits in place, and a click starts it.** `Shift+Enter` opening a
  plain monospace textarea was rejected on sight — it is ugly, and it is also a
  lie: a form control appears where the page says "the note". The note now
  edits AS the note (same size, same muted tone, same place, no border), and
  clicking one puts the caret in it.

  WHICH click is the reconciliation this needed, and the answer moved once
  under evidence. In Workflowy a note is always shown in full and is always one
  click from the caret — there is no clamped state to reconcile, because the
  clamp is olai's own compression of it (notes-single). So the faithful mapping
  is onto the EXPANDED note: the clamped line expands, as it has since that
  item, and a click in the note you are now reading takes the caret — one click
  from what Workflowy would have been showing you all along. One click doing
  both was built first and is worse for a reason the tests found rather than an
  argument: the expanded note is the only place a row draws its rendered
  markdown and its `see` links, so a click that went straight to source deleted
  a reading surface to save a click. Clicking away still folds it; `Shift+Enter`
  is still one key from the title for a keyboard, and it is the path that never
  expands.

  What DID change for notes-single: clicking an open note no longer folds it
  (that click is the caret's now), so folding is clicking away — which is a
  gesture that item already had. Its scenarios say so.
- **A new row's line sat 1.25rem out of the depth it would commit at.** The
  draft reserved one gutter cell where a row reserves two (the `•••` and the
  collapse triangle), so the line a person typed was not the line they got.
  The widths were already shared; the number of CELLS was not.
- **Walking with `↑`/`↓` showed nothing.** The caret was really there —
  focused, at the end of the text — but a 1px blink in a dense tree is not an
  affordance. The row holding it is toned now, and its bullet takes the accent.
- **The keys were documented only in a package README.** They are a table in
  the client now (`keys.ts`), drawn by a panel the ⌘K palette opens, mirrored
  in the top-level README, and held to covering every action by a unit test.

## Undo, as it shipped (2026-08-12)

The stack holds INVERSES, and the four things that were decided while building
it are all consequences of one choice: an undo is a WRITE.

- **WHAT IS ON THE STACK: every op this tab made, text included.** The dispatch
  said "drafts excluded — the undo stack holds structural ops only", and the
  build read that as "text is not undoable", which the human found by driving
  it (2026-08-12): retype a title, let it commit, press ⌘Z, and the answer was
  "nothing to undo" — an undo that does not undo. The ruling is about the
  CARET, not about text. While an editor is open the chord is the input's own
  (and Escape abandons the draft); the moment a draft COMMITS it has produced
  an op like any other, and the text it replaced is a perfect inverse. The one
  thing text needs that structure does not is a guard: the inverse carries
  `was`, the text it expects to find, so putting back what this tab replaced
  can only overwrite what this tab wrote — somebody else's words are refused,
  in the same shape as every other refusal here.
- **Where the inverse is derived: the server, at apply time.** The facts an op
  destroys — the parent a row had, the sibling above it, the mark a toggle
  replaced, the words it overwrote — are facts about the set the write was
  judged against. A tab
  keeping its own note of them would be the second reading this whole seam is
  written against ("the wire verbs are INTENTS", above), and the two would
  differ exactly when it matters: when somebody else is writing too. So
  `edit.apply` answers with what would take the write back, and the browser's
  stack is a list of things the server said.
- **What a stack entry is: a LIST of edits, usually one.** Two only where the
  ops layer needs two: putting `todo` back on a node that is now `done` is
  refused in one call ("nothing should decide on your behalf that finished work
  is not finished"), and doing it in one HERE would be the web doing something
  MCP cannot, which HACKING forbids. So it is the two calls an agent would
  make.
- **Undo restores the prior MARK, not the prior mark's stored VALUE.** The
  judgment call the dispatch named, and it goes to consistency: `done` is
  re-stamped with the instant the undo was made, and `todo`/`doing` go back as
  `true`, because that is what `set_done` / `set_todo` write and there is no op
  — for an agent or for a keyboard — that writes a mark value of its caller's
  choosing. What an undo restores is the fact, and the clock says when the
  person decided it.
- **Un-creating a row archives it — and that is not the delete key.** `archive` is the only removal the set has,
  and it is a trash rather than a shredder — the node keeps its id in
  `Archive.jsonl`, so everything pointing at it goes on resolving. It is
  refused for a row that has grown children since: an undo may take back what
  it made, never what somebody built on it. The cost was that it did not come
  back out (a `move` is same-file by the format), so that one entry said it
  could not be redone rather than leaving a ⌘⇧Z that did nothing.

  What that cost WAS had a name as of the inventory below (2026-08-12): there
  was **no unarchive on any face**, an equal absence rather than a deviation —
  one op to build once in the ops layer and expose to both faces together.
  **That day came (`trash-parity`, 2026-08-13)**: `unarchive` /
  `unarchive_node` exist on both faces, the un-create's inverse is an
  `unarchive` carrying the place the row sat, and this entry stopped being the
  one that cannot be redone — nothing else here changed, exactly as predicted.
  The other half of that ruling closed earlier the other way (`menu-verbs`):
  the `•••` menu's archive door, behind its confirm.
- **A move whose recorded parent has been archived** surfaces as the ops
  layer's own cross-file refusal, verbatim, and the entry is dropped — the
  other judgment call the dispatch named. Nothing here invents a sentence for
  it: the parent is in `Archive.jsonl` and the row is not, a parent is
  same-file by the format, and `planMove` already says exactly that.

What it is NOT: a snapshot restore, persisted, cross-tab, or aware of the
agent's writes. ⌘Z takes back what THIS tab did, on THIS outline, this session.

## Drag-drop and multi-select, as they shipped (2026-08-13)

The item this file's inventory filed twice, and the whole of what it needed
from the layers below was **nothing**. No wire verb, no op, no change to the
planner. That is worth stating first because it is the result rather than the
approach: a drop is "this row goes under that parent, after that sibling",
which is `place` — the verb minted for an undo, and the one placement `Anchor`
cannot spell — and a bulk gesture is the single-row edit repeated. Five things
the build decided:

- **A drop is a GAP plus a DEPTH, not a target row.** Workflowy's gesture is a
  caret for the tree. A gap alone cannot tell "last child of the branch above"
  from "next sibling of that branch's parent" — those are the same line on
  screen — so the pointer's X is read as well, and the indicator moves sideways
  to say which was meant. That is the one piece of real arithmetic here and it
  is pure over measured rows (`web/src/client/drag/plan.ts`).
- **Pointer events, not HTML5 drag-and-drop**, which is the call
  `layout/resize.ts` already made for the panel edges and for the same reason:
  the browser's gesture owns a ghost image, a protected data store and an
  element-based `dragover`, none of which is what a gap-and-depth drop wants.
  The half nobody predicts is that the native one must be turned OFF — a bullet
  is an `<a href>`, every link is draggable for free, and the platform's
  link-drag fires `pointercancel` at the gesture underneath it. That was the
  whole of "the indicator appears for one frame and vanishes".
- **The rows being carried are left OUT of the ones a drop can land beside.**
  Which makes "you cannot drop a branch inside itself" true by construction
  rather than by a guard — and leaves a tree behind, so the walk back for an
  ancestor always finds one. The ops layer's loop refusal is still there; it is
  simply unreachable by this gesture.
- **A pick and a caret are never both live, and that is what lets the keys be
  the same keys.** `Tab` over a pick indents the pick; `Tab` in a row indents
  the row. Picking rows closes the draft (committing it first — a pick is not a
  way to abandon what was typed), and clicking a title puts the pick away. A
  third key layer that had to coexist with the row layer would have needed a
  second grammar for bulk, which is a thing to learn rather than a thing to
  already know.
- **The ORDER a bulk run goes out in IS the shape it produces.** Each edit is
  judged against what the one before it did, so indenting a run goes downwards
  (`B` under `A`, then `C`'s row above is `A` again, so it follows `B` under it)
  and outdenting goes upwards (downwards, each row lands immediately after the
  old parent and the run comes out backwards). Two lines of table, and the only
  thing in this feature that a reader would have to re-derive.

Two things it deliberately did not do. **Drag-across** — Workflowy's fifth
picking gesture — is not built: it wants a marquee over a tree that also has
native text selection in it, and the other four gestures reach every pick it
would. And **there is still no delete key**: the bulk put-away is a button on
the selection bar, behind the same confirm the `•••` menu asks, because the
human's 2026-08-11 ruling is precisely a ruling about a chord that takes a
branch away — a bulk one would be that at its worst.

## Open

- **Is an archived node FROZEN?** Raised by the review of `trash-parity`
  (2026-08-13) and deliberately left to the human, because it is a decision
  about the SET rather than about a view. The Trash view is read-only, and
  `/o/Archive.jsonl` opens it — but `/n/<archived-id>` is still the ordinary
  node page, with its editor, and the day page and the agenda still list
  archived dated work and link to it (the human's own 2026-08-11 ruling: work
  that was put away is still work that happened).

  The reason this PR did not simply close that page: **the ops layer permits
  editing an archived node.** Nothing in the planner reads `isArchived` on the
  way into `set_title` / `set_desc` / `set_date` / the marks — the flag gates
  blockedness, the change classification and unarchive's own rules, and
  nothing else. So an agent can retitle archived work today. Making the web
  page refuse would be the web expressing LESS than MCP, which is
  `editor-op-parity` again with the faces swapped — this item's own bug, in
  reverse.

  So the question is not "should the page be read-only" but "should the SET
  refuse to edit what has been put away", answered once in the ops layer and
  met identically by both faces. That has real consequences (an agent could no
  longer fix a typo in archived work; it interacts with the day/agenda
  ruling), which is exactly why it is the human's to rule on rather than a
  parity fix's to assume.

- ~~**Derived status in the edit UI**: unlike Workflowy, completing a parent isn't just unpropagated — it's *refused* (derived state).~~ **Closed 2026-08-11** (`hide-done-scope`): status derivation is gone, so olai IS the Workflowy model here — `Ctrl+Enter` on a parent stores a mark like it would on a leaf. The rollup badge is drawn beside an editable row like any other, since the editor replaces only the title span.
- **Delete without undo — deferred entirely, 2026-08-11 (human), and STILL OPEN.** `undo` did not close it. What that item shipped is the UN-CREATE — the inverse of an `add`, sent by no key, over a row that was just made and has nothing under it, resolving to `archive` — which is the "arrives with undo" half read strictly. A delete KEY (which rows? a subtree? a confirmation?) is untouched and is the human's to rule on.
- ~~**A write's `nudge` has nowhere to go on the keyboard path.**~~ **Closed in this item**: it is a dim line under the row, dismissed by the next keystroke. See above.
- **Keeping a caret across a server-authoritative redraw is a primitive nobody owns.** The editor holds a focused element through a frame it did not cause — the write answers on one channel and the file arrives on another, in either order, and the redraw either moves the element or replaces the branch that drew it. That is not an outline problem; it is what any editor over this kind of live store has to solve, and olai has graduated this shape before (`listener.ts`'s sequence became `@kolu/surface-app`'s `serveSurfaceApp`, kolu#2137). One consumer today, so it stays where it is used (`web/src/client/edit/editing.tsx`) — recorded here so the second consumer is the moment somebody remembers, rather than the moment somebody re-derives it.

  **The second consumer arrived (`dragdrop-multiselect`, 2026-08-14)**, and it
  moved: a multi-selection is a SET of places, and a bulk indent redraws every
  one of them under a new chain of ids. The half that is arithmetic — where the
  record standing at this place is drawn now — is `refound` in
  `web/src/client/edit/order.ts`, beside the other two questions about the rows
  on screen, and both the caret and the pick are one line over it. What is still
  nobody's, and is the half the paragraph above is really about, is holding the
  FOCUS through that frame; that remains one consumer's (`editing.tsx`'s
  `settling`), and the graduation note stands for it.

## The full Workflowy modification inventory — researched 2026-08-12

Every way a Workflowy user changes their outline, from the official hotkey
table, the bullet-types page, the bullets/menu page and the export article,
mapped to where olai stands. This is the completeness check the Editor
subtree is measured against; the first research pass (above) took the
keyboard loop and missed several whole categories. Sources:
workflowy.com/help/hotkeys, /help/bullet-types, /help/bullets.md,
zendesk 205757575 (export formats).

Status keys: **shipped** (item, PR) · **filed** (roadmap id) · **MISSING**
(no roadmap item as of 2026-08-12).

### Structure

| Op | Workflowy trigger | olai |
|---|---|---|
| New sibling | `Enter` | shipped (`self-edit` #109) |
| Indent / outdent | `Tab` / `Shift+Tab` (also `Alt+Shift+→/←`) | shipped (#109) |
| Move among siblings | `Alt/Ctrl+Shift+↑↓` | shipped (#109) |
| Split at caret / merge into previous | `Enter` mid-text / `Backspace` at line start | filed `split-merge` |
| Drag-drop subtree | drag the bullet | **shipped** (`dragdrop-multiselect`) — pointer events, not HTML5 DnD; the drop is a GAP plus a DEPTH, sent as the surface's existing `place` verb |
| Multi-select + bulk complete/move/indent/delete | five gestures | **shipped** (`dragdrop-multiselect`), four of the five: modifier-click, shift-click, shift-arrows, double `⌘A`. DRAG-ACROSS is not built — it wants a marquee over a tree that also has text selection in it. Bulk complete / move / indent / drag are the single-row op repeated; "delete" is the Trash, on the bar, behind the same confirm the `•••` menu asks |
| **Duplicate** (subtree; result auto-tagged `#copy`; also `Alt+Drag` clone) | `Alt/⌘+Shift+D`, menu | **MISSING** |
| **Move to** (search dialog; moves subtree anywhere, across lists) | slash command, menu | **MISSING** — olai's version is the harder cross-OUTLINE move: `parent` is same-file by the format, so this is an op design (move vs re-create vs mirror), not just a dialog |
| **Delete** (recoverable from Trash) + **Trash restore** | `Ctrl/⌘+Shift+Backspace`, menu | ruled 2026-08-11: still no delete affordance. olai's trash is `Archive.jsonl`, and ARCHIVE has one — the `•••` menu's `Move to Trash` (né `Archive`), subtree with a confirm naming the blast radius (human, 2026-08-12), closing `parity-archive`. **Trash restore shipped too** (`trash-parity`, 2026-08-13, closing `parity-unarchive`): the sidebar's Trash draws every archive read-only, `Put back` sends the `unarchive` op both faces got together, and the confirm now promises the bin it implies |
| **Expand / collapse, persisted** (double-click triangle = all; `Ctrl+Space`, `Ctrl+↓/↑` variants) | per-node, saved | olai collapse is session view-state; whether stored collapse is a modification olai wants is **undecided** (it is a WRITE in Workflowy) |

### Marks

| Op | Workflowy trigger | olai |
|---|---|---|
| Complete | `Ctrl/⌘+Enter`, menu | shipped (#109) |
| Convert to/from to-do | `/to-do`, menu; a new sibling under a to-do inherits to-do-ness | shipped for the MOUSE (`menu-verbs`): the `•••` menu writes all three marks and clears one, the entry for the mark a row already carries left out, and the ops layer's refusals quoted verbatim — including the two clicks it takes to walk `done` back, which is what an agent does too. No KEY for `todo`/`doing` (Workflowy has none either), and the inheritance nuance stays undecided |
| Show/hide completed | `Ctrl+O` | shipped (`hide-done-scope`) |

### Text and formatting

| Op | Workflowy trigger | olai |
|---|---|---|
| Title / note editing | inline, `Shift+Enter` | shipped (#109, revised in place) |
| **Inline formatting: bold / italic / underline, inline code, strikethrough via toolbar** | `Ctrl/⌘+B/I/U`, floating toolbar on selection | **MISSING** — titles RENDER inline markdown (#84/#113) but no key writes it; formatting keys should emit the markdown, not HTML |
| **Text color / highlight** | toolbar | **MISSING** — needs a markdown-honest answer (or a decision to skip) |
| **Bullet-type conversions: H1/H2/H3, paragraph, code block, quote block, numbered list** | slash commands (`/h1`, `/quote`…), context menu | **MISSING** entirely — olai nodes have no "kind"; decide which types olai wants and their format story before any UI |
| Live markdown recognition while typing | automatic | partial — olai renders md on commit; type-time recognition undecided |

### References, links, dates

| Op | Workflowy trigger | olai |
|---|---|---|
| Mirror creation | `((` search, `Alt/⌘+Shift+M`, menu | filed `input-widgets` |
| **Mirror detach (back to copy) / remove placement** | menu | remove placement shipped (`menu-verbs`): `Remove this placement`, drawn on any row whose RECORD is a placement (asked of the record, so the degenerate rows need no case — though a set holding a mirror of nothing is refused by the validator, so such a row is not on screen anyway) — and refused in the op's own words when something still names the placement. DETACH (turn a mirror back into a copy) is not olai's gesture and is not filed: it would mint a new node, which is a duplicate rather than a removal |
| **Copy link to node** (internal link others can paste) | `Alt/⌘+Shift+L`, menu | partial — the `•••` menu HAS "Copy link to node" (corrected 2026-08-12; the first pass of this table missed it); no keybinding, and nothing autocompletes an internal link in a title |
| Tag autocomplete | `#` / `@` | filed `input-widgets` |
| Date insert | `!` natural-language picker | filed `input-widgets`; CLEARING a stored date shipped (`menu-verbs`) — `Clear date`, drawn only on a dated row — so what is left for that item is putting one ON, which is a thing you type rather than a thing you choose from a list |

### Clipboard and interchange

| Op | Workflowy trigger | olai |
|---|---|---|
| **Paste nested text as a subtree** | paste multi-level bullets | **MISSING** — the capture path Workflowy is loved for; nothing filed |
| **Copy/export subtree** (Plain text, Formatted, OPML, JSON) | menu → Export | PLAIN TEXT shipped (`menu-verbs`): `Copy as text` puts the subtree on the clipboard tab-indented, titles verbatim, notes one level under their node, nothing encoding a mark or a date (human, 2026-08-12). The other three formats are unfiled, and a paste-IN parser for the same shape is the row above |
| **Import** (paste is the main door; files export/import for whole accounts) | paste / settings | **MISSING** (whole-account import is likely out of scope — olai's corpus IS files — but paste-in and copy-out are not) |

### The bullet/context menu itself

Workflowy's per-node menu carries: Complete · Add note · Duplicate · Mirror ·
Copy link · Move to · Format conversions · Export · Share · Expand all /
Collapse all · Delete. olai's `•••` menu started as #102's styling with five
READING verbs, and `menu-verbs` gave it the write half: Zoom in · Expand /
Collapse · Expand all · Collapse all · Copy link — then a rule, and below it
Mark todo / Mark doing / Complete / Clear mark · Clear date · Remove this
placement · Archive (subtree, behind a confirm naming how many rows go) · Copy
as text. Each is drawn only where it applies, so the panel is short on a leaf
and long on a marked, dated branch.

What is still Workflowy's and not olai's, from that list: **Add note** (olai's
note is one click on the row, so a menu entry would be a second door to the
same place — deliberately not built), **Duplicate** and **Move to** (both
MISSING above, and both genuine op design), **Mirror** (creation is
`input-widgets`' `((`), **Format conversions** (olai nodes have no kind),
**Export** beyond plain text, **Share** (out of scope), and **Delete**, which
is nobody's op: `Archive` is the put-away, ids kept.

### Deliberately out of olai's scope (decided by inspection, revisit on demand)

Share/collaboration (olai is a served directory, not a multi-tenant account),
boards/kanban bullet type, file/image upload into nodes (adjacent to
`md-editing` and `/media`; revisit there), templates, star/favorites
(navigation state, not a modification), print.

### The consistency-rule reading (the sharpest framing)

HACKING.md: "MCP and Web ops must be consistent; never deviate." The reading
that filed `editor-op-parity`: the web editor could express
`add / move / toggle / title / desc` (+ `remove` as undo's inverse) while MCP
could also express `archive`, `set_date`, `set_doing`/`set_todo`, `set_see`,
`set_after`, `add_mirror`/`remove_mirror`, `create_outline` — and NEITHER face
could unarchive.

`menu-verbs` closed four of those from the `•••` menu — `mark` (all three,
and clearing one), `date`, `unmirror`, `archive` — each as an arm on the same
intent union and a resolver arm beside it, sending the request the equivalent
tool sends. What that left, in order of what it would take:

- `set_see` / `set_after` (`parity-see`, `parity-after`): both want a node
  SEARCH to name the other end, which is the same widget `input-widgets` is
  building for `((`. A menu entry cannot ask "which node?".
- `create_outline` (`parity-create-outline`): the sidebar's, not a row's.
- setting a date: the `!` picker, `input-widgets`.
- ~~UNARCHIVE (`parity-unarchive`): still no op on either face, and the one
  entry here that is an equal absence rather than a deviation.~~ **Closed
  2026-08-13 (`trash-parity`)**: the op was born in the ops layer and both
  faces got it together — `unarchive_node` for the agent, the Trash view's
  `Put back` for the mouse.

Duplicate, move-to, paste/export, formatting and bullet types remain genuinely
new design work, each its own item.

One shape worth keeping from the build: **a fence a UI wants does not belong on
the wire.** Archive takes a subtree because `archive_node` does, and the
confirm that names the blast radius is the panel's own second step — put in the
schema, it would have been a rule the agent's own op does not have, which is
the deviation read backwards.
