# The Second Pane

Status: built, 2026-08-17. Dispatched from the artifact "The Second Pane" against Workflowy's native panes and the MultiFlow extension. Saved layouts (a node whose children restore a split) are out of scope.

The bugs this exists not to reproduce: a second pane that is a stripped view; focus that is implicit or "whichever was last clicked" without a ring; a link rule that targets "the leftmost" or "the primary"; a layout that dies on reload.

## A pane is a route

A pane holds exactly what a lone view holds: the page (an outline file, a zoom, a day, the agenda, the trash, a document), the zoom target, and the filter. It renders the **same** page component (`PageView`) with all its chrome — breadcrumbs, filter box, widgets. There is no side-view.

The addressable layout is a small tree: a **leaf** (one route) or a **split** (an axis + ordered children + their fractions). Collapse is a fraction of zero. Today's product only writes a lone leaf or a **single root split on the row axis** — children side by side. A one-level row still prints as the flat `/s/` list this app has always written (`?w=` fractions, `?f=` the focused leaf, no `a=`, no `t=`), so existing links stay byte-for-byte.

The codec already has a place to grow: `?a=col` is a one-level column; `?t=col(leaf,row(leaf,leaf))` (and a nested `?w=`) is a tree. Absent or unknown axis is a row. The product does not write those yet.

Reload restores the layout. Back/forward walks it. Sharing the URL shares the workspace. Closing the second-to-last pane returns to a plain page address.

`?q=` stays a per-route citizen (#221). It lives **inside** each encoded pane, never as the workspace's own query — `/doc/` still carries no filter.

## Focus is explicit

Exactly one pane is focused. When there are two or more it wears a visible ring. Every keyboard shortcut, the palette, and filter typing act on the focused pane. Click focuses. Alt+Left / Alt+Right move focus (wrapping).

## Links are deterministic

- A plain click navigates the pane you are **in**.
- Alt+click on a bullet, breadcrumb or internal link opens it in the pane to the **right** — reusing that neighbour if it exists.
- Alt+Shift+click forces a new pane immediately to the right.

No rule ever targets "leftmost". A click in the sidebar or the palette has no pane around it, so it acts on the focused pane. Sidebar links are `<Link>`s, so Alt+click on one opens to the right of the focused pane. Palette rows and the header search box activate with `go` — they are not links, and they do not claim Alt.

Ctrl/Cmd+click is still the browser's (a new tab). Alt is the one modifier this app claims, and it is claimed **beside** `ours`, not inside it — the seal that ships `ours` into a previewed page must not start intercepting a key the frame would have given to the browser.

## Arranging

- ⌘⇧W / Ctrl+⇧W closes the focused pane (the close-tab chord is the browser's; this is the equivalent we can receive). The header's × and the palette's "Close pane" are the same verb. Closing the last pane is a no-op.
- Dividers drag to resize. Below 180px a pane **collapses** to a labelled vertical rail. Click the rail to re-expand. Collapse and close are different verbs.
- Dragging a pane's header reorders the list.
- On a narrow screen the same URL, same list, projects to a tab strip over one column.

## Drag between panes

Panes are sibling components over the one store, so a drop from one tree into another is the outline's own `place`. The drag today measures **one page's** rows when the gesture begins (`edit/Editable.tsx` owns that lifetime). Crossing panes is a rewrite of that lifetime, not a hook. Until that rewrite, a row carried out of its pane has no landing.

## Previews and dismissal

#219 freed document bodies from a shared watch set: interest is counted per path, so two panes showing two documents (or the same one) do not evict each other. Landing on a heading is **per pane** (`router.landing()` carries the index), so a document in the other pane is not yanked to a fragment it did not ask for.

The overlay stack stays **global**: one Escape, one top layer (`topmost.ts`). Completions stay per field, the way they already were. A pane does not get a stack of its own.

## What the shape permits, and what a horizontal-split PR still adds

The value and the URL can already name a column, and a column that holds a row. `workspace.ts` is that value, next to the bijection. `Panes.tsx` is still the only projection: one horizontal row, a rail below 180px, a tab strip on a narrow screen. `pane/geometry.ts` is the pure snap (delta + extent, so a column can hand `dy` and a height).

A future PR that ships horizontal splits still has to add, and only there:

- a **column projection** (stacked children, a horizontal divider, a rail that is a horizontal strip)
- **nested gestures** (which split a divider belongs to; Alt+click “to the right” when the neighbour is a column)
- the **tab story** for a column, and for a tree, on a narrow screen (today's tabs assume one row of leaves)

Saved layouts — a node whose children restore a split — remain a follow-up.
