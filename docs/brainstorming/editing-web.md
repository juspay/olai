# Human editing in the web UI

Status: brainstorming ahead of the Editor theme (keyboard editing, then editor growth). Reference model researched 2026-08-09: Workflowy, from its official help/blog docs (a few details are community-sourced; flagged).

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
- **Undo deferred** out of the first PR — git is the recovery net until it lands. When it comes, client-side op inverses ("undo *my* last op", concurrent-editor-safe) is the leading candidate.
- **Desc editing**: `Shift+Enter` opens a plain textarea under the node; rendered markdown returns on blur. Desc is one verbatim string — a textarea is honest, and the draft-cell model applies unchanged.
- **First-PR keybinding set**: Enter (add sibling), Tab/Shift+Tab (indent/outdent), Alt+Shift+↑↓ (move), Ctrl+Enter (toggle done), Shift+Enter (desc), delete. Multi-select, drag-drop, `((` mirror creation, `!` date picker, `#` autocomplete: editor growth.

## Open

- ~~**Derived status in the edit UI**: unlike Workflowy, completing a parent isn't just unpropagated — it's *refused* (derived state).~~ **Closed 2026-08-11** (`hide-done-scope`): status derivation is gone, so olai IS the Workflowy model here — `Ctrl+Enter` on a parent stores a mark like it would on a leaf. What the edit UI still owes it is the rollup badge in an editable row, and somewhere to show a write's `nudge` (the last task under a parent going done) that is not a refusal, because nothing about this is refused any more.
- **Delete without undo**: until the undo item lands, a keyboard delete is unrecoverable inside the app — whether it needs a confirm step (or a brief in-app grace) is a first-PR design detail.
