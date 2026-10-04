/**
 * What a press on a link a reader WROTE is asking for — read off the anchor,
 * with no component and no router in hand, so it is plain data in and out
 * (`../routing.tsx` re-exports it beside `useFollow`, which answers it).
 *
 * Under `contracts/` because it is a helper of the `routing` door rather than a
 * door of its own: the bundle fence lets a declared contract reach its
 * package's `src/contracts/`, so no new public export is needed for a module
 * split out only so its test can run without JSX.
 */
import { destinationOf,ours,splitClick } from "@olai/web/client/press.ts"
import type { Route,Routing } from "../routes.ts"

/**
 * The page a click on a link inside RENDERED MARKDOWN is asking for, or `null`
 * for one to leave alone.
 *
 * Same rule as `../routing.tsx`'s `Link`: a plain press is in-place in this pane; the
 * caller decides what to do with it. Split presses are not this function's
 * — they fail `ours`, so the pane's own listener can see Alt and open
 * right without this claiming the event as a same-pane go.
 */
const routeFrom = (
  /** The grammar to read the `href` with — the router's own, handed in rather
   *  than reached for, because parsing a plugin's URL is a question about the
   *  mounted roster ({@link Router.routes}). */
  routes: Routing,
  event: MouseEvent,
  claimed: (event: MouseEvent) => boolean,
  /** Which address of the anchor this press follows. */
  read: (anchor: Element) => string | null,
): Route | null => {
  if (!claimed(event)) return null
  const target = event.target
  if (!(target instanceof Element)) return null
  const anchor = target.closest("a")
  const href = anchor === null ? null : read(anchor)
  return href === null ? null : routes.routeIn(href)
}

/** A plain press reads the `href` alone: on an in-page fragment that is the
 *  browser's own scroll, and must stay one. */
export const followed = (routes: Routing, event: MouseEvent): Route | null =>
  routeFrom(routes, event, ours, (anchor) => anchor.getAttribute("href"))

/** The route an Alt+click on a written link is asking to open to the right,
 *  or `null`. Pair of {@link followed}, for the press `ours` declines — and
 *  the one that reads an in-page fragment's stamped route, so Alt+click on
 *  `[x](#beds)` or a line of the contents opens that heading on the right. */
export const followedSplit = (routes: Routing, event: MouseEvent): Route | null =>
  routeFrom(routes, event, (event) => splitClick(event) !== null, destinationOf)
