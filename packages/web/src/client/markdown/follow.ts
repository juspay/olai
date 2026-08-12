/**
 * A click on a link inside rendered markdown, answered in place.
 *
 * `<Link>` (../router.tsx) is what makes every link this app DRAWS a route
 * rather than a reload, and it cannot be used here: rendered markdown reaches
 * the page as an HTML string through `innerHTML`, so its anchors are elements
 * no component owns. Without this, a `[the deck](deck.md)` rewritten to
 * `/doc/deck.md` would be a full document load — a fresh bundle, a fresh
 * socket, a fresh snapshot — to move between two files of the same directory,
 * which is exactly the thing a vault of Markdown does all day.
 *
 * ONE delegated listener, on the main pane, rather than a handler per rendering:
 * a page can hold a document, a note per row and a day's own notes, and a
 * listener each would be a listener per rendered block per frame. The pane is
 * also where the router is, which is the other half of why it is there and not
 * inside `<Markdown>` — the chat panel draws the same markdown OUTSIDE the
 * router, and a component that needed one would be a component that could not
 * be drawn there.
 *
 * What it declines is as load-bearing as what it takes. A modified click is a
 * reader asking for the BROWSER's behaviour (a new tab, a download), and a
 * click something else already answered — a `<Link>` deeper in the tree, which
 * runs first — has been answered. Everything else that is not a document's own
 * page is left alone (../routes.ts's `routeIn`), so a link to the internet goes
 * to the internet and a footnote's `#` jump stays the platform's.
 */

import { type Route, routeIn } from "../routes.ts"

/** The page this click is asking for, or `null` for one to leave alone. */
export const followed = (event: MouseEvent): Route | null => {
  // A left click nobody has answered yet. `defaultPrevented` is how a `<Link>`
  // inside the pane says it has this one — the doc reference on a zoomed node
  // is one, and it is drawn in the same rendered column.
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null

  const target = event.target
  if (!(target instanceof Element)) return null
  // `closest`, because what is clicked is usually the TEXT of the link — or a
  // `<code>` or an `<em>` the markdown put inside it.
  const href = target.closest("a")?.getAttribute("href")
  return href === undefined || href === null ? null : routeIn(href)
}
