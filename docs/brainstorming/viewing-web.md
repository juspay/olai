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

## Open

- **The search operator language**: filter-in-place with ancestors kept is settled direction (derived status gives `is:done` free; `has:desc`, `date:`, tag filters map directly), but the operator language is a design of its own — brainstorm before the search item dispatches.
- Starred pages / jump-to / named shortcuts: later, unscoped.
