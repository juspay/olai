# The Second Pane

Status: built, 2026-08-17. Dispatched from the artifact "The Second Pane" against Workflowy's native panes and the MultiFlow extension. Saved layouts (a node whose children restore a split) are out of scope.

The bugs this exists not to reproduce: a second pane that is a stripped view; focus that is implicit or "whichever was last clicked" without a ring; a link rule that targets "the leftmost" or "the primary"; a layout that dies on reload.

## A pane is a route

A pane holds exactly what a lone view holds: the page (an outline file, a zoom, a day, the agenda, the trash, a document), the zoom target, and the filter. It renders the **same** page component (`PageView`) with all its chrome — breadcrumbs, filter box, widgets. There is no side-view.

The split is a list of those routes, in the URL:

- One pane is the address this app has always written (`/o/house.olai?q=…`, `/n/install`, `/doc/notes.md#beds`).
- Two or more wear `/s/`, each pane an encoded `hrefOf` as one path segment, optional `?w=50,50` for width fractions (a `0` is collapsed) and `?f=` for the focused index.

Reload restores the layout. Back/forward walks it. Sharing the URL shares the workspace. Closing the second-to-last pane returns to a plain page address.

`?q=` stays a per-route citizen (#221). It lives **inside** each encoded pane, never as the workspace's own query — `/doc/` still carries no filter.

## Focus is explicit

Exactly one pane is focused. When there are two or more it wears a visible ring. Every keyboard shortcut, the palette, and filter typing act on the focused pane. Click focuses. Alt+Left / Alt+Right move focus (wrapping).

## Links are deterministic

- A plain click navigates the pane you are **in**.
- Alt+click on a bullet, breadcrumb or internal link opens it in the pane to the **right** — reusing that neighbour if it exists.
- Alt+Shift+click forces a new pane immediately to the right.

No rule ever targets "leftmost". A click in the sidebar or the palette has no pane around it, so it acts on the focused pane; Alt+click from there opens to the right of the focused pane.

Ctrl/Cmd+click is still the browser's (a new tab). Alt is the one modifier this app claims, and it is claimed **beside** `ours`, not inside it — the seal that ships `ours` into a previewed page must not start intercepting a key the frame would have given to the browser.

## Arranging

- ⌘⇧W / Ctrl+⇧W closes the focused pane (the close-tab chord is the browser's; this is the equivalent we can receive). The header's × and the palette's "Close pane" are the same verb. Closing the last pane is a no-op.
- Dividers drag to resize. Below 180px a pane **collapses** to a labelled vertical rail. Click the rail to re-expand. Collapse and close are different verbs.
- Dragging a pane's header reorders the list.
- On a narrow screen the same URL, same list, projects to a tab strip over one column.

## Drag between panes

Panes are sibling components over the one store, so a drop from one tree into another is the outline's own `place`. The drag today measures **one page's** rows when the gesture begins (`edit/Editable.tsx` owns that lifetime). Crossing panes is a rewrite of that lifetime, not a hook — named at `web/src/client/pane/crossing.ts`. Until that rewrite, a row carried out of its pane has no landing.

## Previews and dismissal

#219 freed document bodies from a shared watch set: interest is counted per path, so two panes showing two documents (or the same one) do not evict each other. Landing on a heading is **per pane** (`router.landing()` carries the index), so a document in the other pane is not yanked to a fragment it did not ask for.

The dismissal stack and completion stay scoped per composer / per editor, the way they already were. A pane does not share a stack with its neighbour.

## Out of scope

Saved layouts — a node whose children restore a split — are a follow-up.
