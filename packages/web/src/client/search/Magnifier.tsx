/**
 * THE PHONE'S SEARCH DOOR — a magnifier in the bar that lands the caret in the
 * one box.
 *
 * ## What it replaced, and why the box went
 *
 * The bar used to carry a search BOX on desktop and this magnifier on a phone,
 * and the magnifier opened the ⌘K palette because the palette listed hits.
 * Neither of those is true any more: the header's box is deleted and the
 * palette's node-hit half went with it (the human's ruling of 2026-08-21,
 * docs/brainstorming/one-search-box.md). There is one search box in this app —
 * the one above the page — and this is the control that means *that box*.
 *
 * It stays a phone control for the reason it always was one: a phone has no
 * chord, and the bar at 390pt has no room for an input. On desktop the box is
 * already on screen and a second door beside it would be the redundancy the
 * ruling removed.
 *
 * ## The one decision it makes
 *
 * WHERE TO PUT THE CARET WHEN THERE IS NO BOX. A document page carries no `?q=`
 * and so draws no bar (`../routes.ts`'s `narrowable`), and a magnifier that did
 * nothing there would be a door that works on some pages. So it goes to
 * `/search` — the everywhere page, which is nothing BUT a box — and the caret
 * lands there on arrival for the same reason it lands in any box somebody just
 * opened.
 *
 * That is the whole of it, and it is decided here rather than inside
 * `../filter/caret.ts` because it is a question about a ROUTE: which page the
 * reader is on, and whether that page holds a box. The caret module broadcasts;
 * this one knows where the reader is standing.
 */

import { useRouter } from "../router.tsx"
import { EVERYWHERE_ROUTE, narrowable } from "../routes.ts"
import { focusFilter } from "../filter/caret.ts"
import { TESTID } from "../testids.ts"
import { TARGET } from "../touch.ts"
import type { Route } from "../routes.ts"

export function Magnifier(props: {
  readonly go: (route: Route) => void
}) {
  const router = useRouter()

  const search = () => {
    // THE FOCUSED PANE'S ROUTE, which is what "this page" means in a workspace
    // that may be split — the same reading the shelf's chord and the sidebar's
    // active entry are about (`../App.tsx`).
    if (narrowable(router.route())) {
      focusFilter()
      return
    }
    props.go(EVERYWHERE_ROUTE)
  }

  return (
    <button
      type="button"
      // Height is a finger's; width is not a 44px square — that square sat on
      // the wordmark at 360pt.
      class={`${TARGET} inline-flex w-8 shrink-0 items-center justify-center rounded text-paper/70 hover:text-paper md:hidden`}
      data-testid={TESTID.headerSearchOpen}
      aria-label="search"
      onClick={search}
    >
      <span aria-hidden="true" class="text-base leading-none">⌕</span>
    </button>
  )
}
