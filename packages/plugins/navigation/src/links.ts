import { intentOf } from "@olai/surface"
import type { NavigationRouter } from "./routing.tsx"

/** One listener per navigation activation. The mounted pane owns the press;
 * chrome outside panes uses the focused pane of the front lane. */
export const followLinks = (navigation: NavigationRouter): (() => void) => {
  const click = (event: MouseEvent) => {
    const intent = intentOf(event)
    if (intent === null || !(event.target instanceof Element)) return
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]")
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return
    const route = navigation.routes.routeIn(anchor.href)
    if (!route) return
    const host = anchor.closest<HTMLElement>("[data-pane-id]")
    const router = host ? navigation.lanes().find(lane => lane.panes().some(pane => pane.id === host.dataset.paneId)) : navigation
    if (!router || !router.shown()) return
    const index = host ? router.panes().findIndex(pane => pane.id === host.dataset.paneId) : router.focusIndex()
    if (index < 0) return
    event.preventDefault()
    if (intent === "go") router.goIn(index, route)
    else router.openRight(index, route, intent === "new-pane")
  }
  // Solid's delegated component handlers run at document; window sees their
  // preventDefault and lets row editors, tags and drag suppression finish first.
  window.addEventListener("click", click)
  return () => window.removeEventListener("click", click)
}
