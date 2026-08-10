# Viewing & navigation in the web UI

Status: brainstorming ahead of the Viewing theme's next items. Reference model researched 2026-08-09: Workflowy, from its official help/blog docs (a few details are community-sourced; flagged).

## Where we are (shipped in see-outline)

Sidebar of found outlines, one tree per route, mirrors inline (marked), client-local collapse/expand, derived done/doing/open status, #tags styled in titles, all-errors view.

## Workflowy's model (the distilled facts)

- **Zoom is the organizing idea**: any bullet is a page. Click the bullet to zoom in; the node becomes the heading, its children the body. Keyboard zoom in/out (`Alt/⌘+.` / `Alt/⌘+,`). Every bullet has a **permanent URL** (short stable id in the fragment) that survives edits and moves.
- **Breadcrumbs**: when zoomed, the ancestor chain shows at top; every crumb is clickable; Home returns to the root.
- **Collapse/expand**: per-node toggle plus expand/collapse-all variants (hover menu; `Ctrl/⌘+↓/↑` per level). Collapse state is **per-device, not synced** (community-confirmed) — which independently validates our client-local-collapse decision.
- **Search filters in place**: results render as matching nodes *with their ancestors* (and descendants), live as you type. A real operator language: `is:complete`, `has:note`, `changed:`/`last-changed:7d`, date filters, `"exact"`, `-not`, `OR`, and a nested-ancestry operator (`>`). Searches can be starred (saved with their zoom location) and named.
- **Tag click = filter**: clicking a `#tag` filters the current view to items carrying it, ancestors kept for context, scoped to the current subtree ("downstream").
- **Navigation aids**: starred pages in the sidebar (drag-reorderable); a Jump To dialog (`Ctrl/⌘+K`) — type-ahead over all bullets plus recent starred; named "shortcut" codes that jump straight to a bullet or saved search; zoom history behaves like browser back/forward (community-sourced detail).
- **Completed toggle**: a per-page Visible/Hidden switch for completed items (`Ctrl+O`); hidden, never deleted.
- There is also a kanban **board view** over the same outline — noted, not pursued here.

## Mapping to olai — resolved 2026-08-09

- **Zoom URL is `/n/<id>`**: one route per node. Ids are stable and set-unique, so the permalink survives renames and moves — even across files; the outline is derivable, not part of the address. The zoomed page shows title as heading, desc, then children.
- **Breadcrumbs are always the canonical parent chain**, regardless of whether you arrived through a mirror. Stateless: the same URL always shows the same crumbs.
- **First navigation PR**: zoom + breadcrumbs + permalinks + done-visibility toggle. Independent of live-updates — it only needs the see-outline tree, so the two can proceed in parallel.
- **Tag click lands with search**, not navigation — it is a canned filter, shipped when the filter machinery exists. Tags stay decorative until then.
- **Done-visibility is per-view** (each zoomed view/outline its own Visible/Hidden switch), a client-local cell alongside collapse state.

## Documents — resolved 2026-08-10 (md-docs)

Racket parity was the starting point (`master-racket`'s `docs/syntax.md` §Documents and `docs/cli.md`): a node's `@doc` renders inline when that node is zoomed and shows one line of the file elsewhere, and every found `.md` is a document in its own right. What had to be decided here is how the text reaches the browser, and what a document is allowed to point at.

- **The text rides the snapshot.** A `.md` decodes to its text through the store's existing codec, so it is cached against the same stamp, re-read only when it changes, and published in the same revision as every outline. Liveness, the first-line preview and the page all fall out of machinery that already existed, and there is one answer on screen to "what does this directory say right now". What lost:
  - *an HTTP route plus a re-fetch on every revision bump* — a second read path, a second thing to invalidate, and a page whose outline and document could be two different reads of the disk;
  - *a per-document surface stream* — the same second read path with better manners. It buys bandwidth (the text of every served document rides every frame today) and costs a mechanism; it stays the escape hatch if a directory of large documents ever makes a frame hurt, and nothing yet does;
  - *carrying only the first line* — two encodings of one file, and the page would still need the rest from somewhere.
- **`/doc/<path>`, a second prefix rather than more work for `/o/`.** An outline and a document are two different things a file can be (`fileKind`), so the address says which: a URL means one kind of page before the set is in hand, and renaming a `.md` to a `.jsonl` is a different page rather than the same address quietly changing what it draws.
- **Documents are listed in the sidebar**, in a section of their own rather than only under the nodes that attach them: most `.md` files in a directory are attached by nothing, and a file somebody put there to read is still a file to read.
- **Pictures are the one thing that cannot ride the snapshot** — the browser fetches an `<img src>` itself — so there is one HTTP route, `/media/*`, restricted to picture extensions, with the URL declared once in `surface` because its writer (the renderer) and its reader (the route) are in packages that cannot import each other. A `..` in a markdown `src` is CLAMPED at the served root by the resolver (a shared picture folder beside the documents is a real arrangement) while the route refuses a climbing segment outright — containment is a property of both ends rather than of one of them. Racket refused `..` in the renderer too; ours does not need to, and gains the shared-folder case.
- **Highlighting runs after the sanitiser.** The `hljs-` spans are ours, produced from the code's own text; the `language-…` class that produced them is the reader's, and is already on the sanitiser's default allowlist. It is bundled with the client rather than served from `/static/` as racket did — the bundle is how everything else in this client arrives, and a CDN was never on the table.
- **Footnote ids are minted per rendered block**, from a hash of the text and the file it is in, and every same-block fragment link is minted with them. A page draws many independent renderings (a note per row, a document, the notes under it) and the parser mints `fn-1` in each of them. Two *identical* notes still collide, and that is accepted: they are the same text, so the link lands somewhere that says the same thing.

## Theming — resolved 2026-08-10 (theming)

Racket parity, and the parity is the *palettes*: fifteen named ones, `chalk` the default, `data-theme` on `<html>`, `localStorage`, no server round-trip. What had to be decided here is the vocabulary they are written in and where the CSS comes from.

- **The table is the source, and the CSS is generated from it.** `theme/palettes.ts` is fifteen rows; the build appends one block per row to the Tailwind output, and the picker draws one chip per row. Hand-written CSS was the alternative and it is the same eight lines copied fifteen times — one place per theme for a new token to be forgotten. The cost is that `styles.css` no longer contains the palette a reader might go looking for; the answer is a test (`theme/css.test.ts`) that holds the eight `@theme` defaults to the default row, since Tailwind can only emit `text-muted` for a `--color-muted` it has *seen*.
- **Eight tokens, not the racket skin's fourteen.** Each row is that row's fourteen read through one documented mapping (`dim`→`muted`, `line`→`rule`, `blue-fg`→`accent`, …). The six that did not come — a second and third surface, a pill ground, three accent grounds — have no home in this client, which paints one paper and gets its accent grounds from an opacity. A token nothing paints with is a value nobody can check. Adding one is adding a column, and the row type makes that a type error at every row that owes a value.
- **The eleven imported palettes were re-read from the original theme stylesheets**, not trusted second-hand, `var()` chains resolved; three rows depart from the mapping and each says where and why in its own comment. Their four image-backed themes stay out: without the photograph each is a duplicate of a row already here.
- **The OS does not vote.** `prefers-color-scheme` is gone from the sheet. It chose the palette before, which meant a page that changed under a reader who had already said what they wanted, and two ways to be dark that could disagree. A page that has picked nothing reads in the default — which is the one palette that promises AA, so the unchosen page is the legible one. `color-scheme` still rides in every block, because the scrollbars and form controls are the browser's to paint.
- **Picking the default is a pick**, stored explicitly. Storing *nothing* and falling back would make `chalk` mean two things, and a later change of default would silently move everybody who had chosen the old one.
- **Four inline lines in `<head>` restore it**, and that is the only script in the shell. Everything else on the page is deferred, so a theme restored by the bundle lands after the first paint — a flash of the wrong colours on every load. The e2e proves it with a `MutationObserver` installed before any page script, reading `document.readyState` at the moment the attribute appears. The script deliberately knows no theme names: a stored value no row offers is forgotten by the app once it is up, which is the first moment anything knows the list.
- **Each chip wears the palette it offers.** Fifteen names in a 15rem column cannot say what they look like; three inline styles from the table can. Inline rather than utilities because a class built from data is a class Tailwind never scanned.

## Open

- **The search operator language**: filter-in-place with ancestors kept is settled direction (derived status gives `is:done` free; `has:desc`, `date:`, tag filters map directly), but the operator language is a design of its own — brainstorm before the search item dispatches.
- Starred pages / jump-to / named shortcuts: later, unscoped.
