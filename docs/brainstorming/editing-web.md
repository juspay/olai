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
- **First-PR keybinding set**: Enter (add sibling), Tab/Shift+Tab (indent/outdent), Alt+Shift+↑↓ (move), Ctrl+Enter (toggle done), Shift+Enter (desc), delete. Multi-select, drag-drop, `((` mirror creation, `!` date picker, `#` autocomplete: editor growth.

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
  it made, never what somebody built on it. The cost is that it does not come
  back out (a `move` is same-file by the format), so that one entry says it
  cannot be redone rather than leaving a ⌘⇧Z that does nothing.

  What that cost IS has a name as of the inventory below (2026-08-12): there is
  **no unarchive on any face**, which is an equal absence rather than a
  deviation — one op to build once in the ops layer and expose to both faces
  together. The day it exists, this entry stops being the one that cannot be
  redone, and nothing else here changes. The other half of that ruling cuts the
  other way and is worth stating against this PR: the web has no archive
  affordance at all, so what an un-create reaches for is an op only the agent
  can otherwise ask for. It is reached ONLY as the inverse of a row this
  session created — not a general archive door, and not the delete key.
- **A move whose recorded parent has been archived** surfaces as the ops
  layer's own cross-file refusal, verbatim, and the entry is dropped — the
  other judgment call the dispatch named. Nothing here invents a sentence for
  it: the parent is in `Archive.jsonl` and the row is not, a parent is
  same-file by the format, and `planMove` already says exactly that.

What it is NOT: a snapshot restore, persisted, cross-tab, or aware of the
agent's writes. ⌘Z takes back what THIS tab did, on THIS outline, this session.

## Open

- ~~**Derived status in the edit UI**: unlike Workflowy, completing a parent isn't just unpropagated — it's *refused* (derived state).~~ **Closed 2026-08-11** (`hide-done-scope`): status derivation is gone, so olai IS the Workflowy model here — `Ctrl+Enter` on a parent stores a mark like it would on a leaf. The rollup badge is drawn beside an editable row like any other, since the editor replaces only the title span.
- **Delete without undo — deferred entirely, 2026-08-11 (human), and STILL OPEN.** `undo` did not close it. What that item shipped is the UN-CREATE — the inverse of an `add`, sent by no key, over a row that was just made and has nothing under it, resolving to `archive` — which is the "arrives with undo" half read strictly. A delete KEY (which rows? a subtree? a confirmation?) is untouched and is the human's to rule on.
- ~~**A write's `nudge` has nowhere to go on the keyboard path.**~~ **Closed in this item**: it is a dim line under the row, dismissed by the next keystroke. See above.
- **Keeping a caret across a server-authoritative redraw is a primitive nobody owns.** The editor holds a focused element through a frame it did not cause — the write answers on one channel and the file arrives on another, in either order, and the redraw either moves the element or replaces the branch that drew it. That is not an outline problem; it is what any editor over this kind of live store has to solve, and olai has graduated this shape before (`listener.ts`'s sequence became `@kolu/surface-app`'s `serveSurfaceApp`, kolu#2137). One consumer today, so it stays where it is used (`web/src/client/edit/editing.tsx`) — recorded here so the second consumer is the moment somebody remembers, rather than the moment somebody re-derives it.

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
| Drag-drop subtree | drag the bullet | filed `dragdrop-multiselect` |
| Multi-select + bulk complete/move/indent/delete | five gestures | filed `dragdrop-multiselect` |
| **Duplicate** (subtree; result auto-tagged `#copy`; also `Alt+Drag` clone) | `Alt/⌘+Shift+D`, menu | **MISSING** |
| **Move to** (search dialog; moves subtree anywhere, across lists) | slash command, menu | **MISSING** — olai's version is the harder cross-OUTLINE move: `parent` is same-file by the format, so this is an op design (move vs re-create vs mirror), not just a dialog |
| **Delete** (recoverable from Trash) + **Trash restore** | `Ctrl/⌘+Shift+Backspace`, menu | ruled 2026-08-11: no delete affordance. olai's trash is `Archive.jsonl` — but there is **no archive affordance in the web UI at all** (MCP-only `archive_node` — a standing HACKING.md consistency violation, not a growth item), and **no unarchive/restore op on ANY face** (equal absence, so not a deviation — a missing op to build once in the ops layer and expose on both faces together) |
| **Expand / collapse, persisted** (double-click triangle = all; `Ctrl+Space`, `Ctrl+↓/↑` variants) | per-node, saved | olai collapse is session view-state; whether stored collapse is a modification olai wants is **undecided** (it is a WRITE in Workflowy) |

### Marks

| Op | Workflowy trigger | olai |
|---|---|---|
| Complete | `Ctrl/⌘+Enter`, menu | shipped (#109) |
| Convert to/from to-do | `/to-do`, menu; a new sibling under a to-do inherits to-do-ness | **MISSING** — olai's `todo`/`doing` marks have NO web affordance (MCP-only `set_doing`/`set_todo`); inheritance nuance undecided |
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
| **Mirror detach (back to copy) / remove placement** | menu | **MISSING** on the web face (MCP has `remove_mirror` since #117) |
| **Copy link to node** (internal link others can paste) | `Alt/⌘+Shift+L`, menu | partial — the `•••` menu HAS "Copy link to node" (corrected 2026-08-12; the first pass of this table missed it); no keybinding, and nothing autocompletes an internal link in a title |
| Tag autocomplete | `#` / `@` | filed `input-widgets` |
| Date insert | `!` natural-language picker | filed `input-widgets`; **editing/clearing a stored date** must be named in that item's scope |

### Clipboard and interchange

| Op | Workflowy trigger | olai |
|---|---|---|
| **Paste nested text as a subtree** | paste multi-level bullets | **MISSING** — the capture path Workflowy is loved for; nothing filed |
| **Copy/export subtree** (Plain text, Formatted, OPML, JSON) | menu → Export | **MISSING** |
| **Import** (paste is the main door; files export/import for whole accounts) | paste / settings | **MISSING** (whole-account import is likely out of scope — olai's corpus IS files — but paste-in and copy-out are not) |

### The bullet/context menu itself

Workflowy's per-node menu carries: Complete · Add note · Duplicate · Mirror ·
Copy link · Move to · Format conversions · Export · Share · Expand all /
Collapse all · Delete. olai's `•••` menu exists (#102 styling) but carries
almost none of these; as verbs land from the tables above, the menu is where
the mouse finds them — worth keeping as the checklist for menu growth.

### Deliberately out of olai's scope (decided by inspection, revisit on demand)

Share/collaboration (olai is a served directory, not a multi-tenant account),
boards/kanban bullet type, file/image upload into nodes (adjacent to
`md-editing` and `/media`; revisit there), templates, star/favorites
(navigation state, not a modification), print.

### The consistency-rule reading (the sharpest framing)

HACKING.md: "MCP and Web ops must be consistent; never deviate." Today the
web editor can express `add / move / toggle / title / desc` (+ `remove` as
undo's inverse) while MCP can also express `archive`, `set_date`,
`set_doing`/`set_todo`, `set_see`, `set_after`, `add_mirror`/`remove_mirror`,
`create_outline` — and NEITHER face can unarchive. Closing that asymmetry is
one "editor op parity" item (archive + marks + date + edges + mirror-remove);
duplicate, move-to, paste/export, formatting and bullet types are genuinely
new design work, each its own item.
