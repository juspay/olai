# Human editing in the web UI

Status: SHIPPED as `self-edit` (keyboard editing) — what is below is the research and the decisions it was built from, kept because the editor-growth items are built from the same page. Reference model researched 2026-08-09: Workflowy, from its official help/blog docs (a few details are community-sourced; flagged).

## What shipped, and the three things the build decided

The resolved plan below landed as written — same ops layer, no optimistic UI, structural keys as immediate ops, text buffered in a draft cell. Three questions it did not answer came up while building, and the answers are worth keeping:

- **A new row is a draft, not a blank node.** The ops layer refuses a node without a title and is right to, so `Enter` opens an editor where the row will go and the `add` lands the moment it has text (`Enter`, blur, or idle). An abandoned empty row writes nothing — which is also what stops `Enter Enter Enter` from filling an outline with blank bullets and a git log with `capture: `.
- **The wire verbs are INTENTS, not ops requests.** `Tab` sends "indent this", not "reparent under the node above, placed last": the neighbours a placement is computed from are facts about the snapshot, so they are read on the server, against the revision the write is judged against, rather than computed in a tab from a tree some frames old. Same for `Ctrl+Enter`, which sends "toggle" and lets the server read the stored mark. That also keeps the browser's closed list narrower than the agent's (no `create`, `archive`, `see`, `date`, no chosen ids).
- **No optimistic UI costs the CARET, and that is the real work.** A row that indents is redrawn at a new place by a new branch, and a row that reorders has its element moved — both take focus off the input in a browser. So a draft is about a ROW — the record occupying a line, a mirror's own id and not its target's — and it follows that row across the frame, with the editor asking for the caret back once the frame that redrew it has been rendered. What a draft COMMITS is the other id: the node the row SHOWS, so typing in a mirror edits what it stands for while moving one moves the placement. The alternative — echoing the move locally so the row never appears to leave — is exactly the optimistic UI this design is written against.

An `<input>` rather than `contenteditable` for the title (a title is one verbatim line with no markup, so the trade is `#tags` reading unstyled while the caret is in the row) and a textarea for the note, per the plan. Delete stayed out entirely, per the human's 2026-08-11 decision: it arrives with undo — and it did, as the one thing an undo of a create can be. What `undo` settled is a section of its own below.

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

- **Where the inverse is derived: the server, at apply time.** The facts an op
  destroys — the parent a row had, the sibling above it, the mark a toggle
  replaced — are facts about the set the write was judged against. A tab
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
- **Un-creating a row archives it.** `archive` is the only removal the set has,
  and it is a trash rather than a shredder — the node keeps its id in
  `Archive.jsonl`, so everything pointing at it goes on resolving. It is
  refused for a row that has grown children since: an undo may take back what
  it made, never what somebody built on it. The cost is that it does not come
  back out (a `move` is same-file by the format), so that one entry says it
  cannot be redone rather than leaving a ⌘⇧Z that does nothing.
- **A move whose recorded parent has been archived** surfaces as the ops
  layer's own cross-file refusal, verbatim, and the entry is dropped — the
  other judgment call the dispatch named. Nothing here invents a sentence for
  it: the parent is in `Archive.jsonl` and the row is not, a parent is
  same-file by the format, and `planMove` already says exactly that.

What it is NOT: a snapshot restore, persisted, cross-tab, or aware of the
agent's writes. ⌘Z takes back what THIS tab did, on THIS outline, this session.

## Open

- ~~**Derived status in the edit UI**: unlike Workflowy, completing a parent isn't just unpropagated — it's *refused* (derived state).~~ **Closed 2026-08-11** (`hide-done-scope`): status derivation is gone, so olai IS the Workflowy model here — `Ctrl+Enter` on a parent stores a mark like it would on a leaf. The rollup badge is drawn beside an editable row like any other, since the editor replaces only the title span.
- ~~**Delete without undo**~~ **Closed 2026-08-11 (human): deferred entirely** — and it arrived with `undo` as promised, in the narrowest form the promise allows: no delete KEY and no delete affordance, one surface verb (`remove`) that only an inverse produces, over a row that was just added and has nothing under it.
- ~~**A write's `nudge` has nowhere to go on the keyboard path.**~~ **Closed in this item**: it is a dim line under the row, dismissed by the next keystroke. See above.
- **Keeping a caret across a server-authoritative redraw is a primitive nobody owns.** The editor holds a focused element through a frame it did not cause — the write answers on one channel and the file arrives on another, in either order, and the redraw either moves the element or replaces the branch that drew it. That is not an outline problem; it is what any editor over this kind of live store has to solve, and olai has graduated this shape before (`listener.ts`'s sequence became `@kolu/surface-app`'s `serveSurfaceApp`, kolu#2137). One consumer today, so it stays where it is used (`web/src/client/edit/editing.tsx`) — recorded here so the second consumer is the moment somebody remembers, rather than the moment somebody re-derives it.
