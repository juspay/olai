/**
 * The header's door to search: a button that opens the ⌘K palette.
 *
 * ## Why a door at all
 *
 * ⌘K is a chord, and a chord is a thing you have to know. The bar is where
 * this app keeps what is true about the app rather than about the page, and a
 * door you can see is the difference between a feature and a feature somebody
 * told you about. So the bar keeps one, and says the chord on it: a reader who
 * clicks it once has been told the faster way in.
 *
 * ## Why a button and not a box
 *
 * The palette is the one place search is drawn: its rows, its kind selector
 * (`search.box.below`, which this face still declares) and its refusals. A box
 * in the bar with a results panel of its own was a second drawing of the same
 * rows, and the bar needs its width for the tabs. A phone already worked this
 * way; a desktop now does too, and the two differ only in how the door looks:
 * the magnifier on a phone, the word and the chord on a desktop.
 *
 * NOTHING AT ALL where there is no router — the error report and the waiting
 * page. A door that could not open anywhere is worse than no door, and those
 * screens never become ones with a router while this face is mounted.
 */
import { isApplePlatform } from "@olai/web/client/keys.ts"
import { TARGET } from "@olai/ui-primitives/touch.ts"
import { useMaybeGo } from "olai-plugin-navigation/routing"

import { TESTID } from "../testids.ts"
import { openPalette } from "./palette.ts"

export function HeaderSearch() {
  if (useMaybeGo() === null) return null
  const apple = isApplePlatform()
  return (
    <button
      type="button"
      class={`${TARGET} inline-flex w-8 shrink-0 items-center justify-center rounded-control text-muted hover:text-ink md:h-7 md:min-h-0 md:w-auto md:gap-2.5 md:border md:border-rule md:bg-paper md:pl-2.5 md:pr-1.5 md:text-label md:hover:border-muted`}
      data-testid={TESTID.headerSearchOpen}
      aria-label="Search"
      aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
      onClick={() => openPalette()}
    >
      <span aria-hidden="true" class="text-title leading-none md:hidden">⌕</span>
      <span aria-hidden="true" class="hidden md:inline">Search</span>
      <span aria-hidden="true" class="hidden rounded-control bg-desk px-1 font-mono text-caption md:inline">
        {apple ? "⌘K" : "Ctrl K"}
      </span>
    </button>
  )
}
