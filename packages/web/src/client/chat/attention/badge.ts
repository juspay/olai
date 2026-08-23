/**
 * The mark that STAYS: the app's icon says the agent is waiting on you, and it
 * goes on saying it until you look.
 *
 * The banner is an event and this is a state, which is the whole reason both
 * exist. A notification is gone the moment the OS decides it is — swiped,
 * timed out, cleared with forty others — and what it was about is still true.
 * So the badge is recomputed from the reading rather than dismissed
 * ({@link ./alarm.ts}), and the ruling is explicit that it clears when the
 * human focuses the pane and not when the banner is dismissed.
 *
 * TWO CHANNELS, and which one is not a fallback chain but a fact about where
 * the page is running (the ruling: the App Badging API on the installed PWA
 * icon, falling back to a title/favicon dot in a plain tab):
 *
 *   - **installed**, and the browser has `navigator.setAppBadge`: the dock,
 *     taskbar or home-screen icon carries the COUNT. This is the one that
 *     works with the window behind everything else, which is what the badge is
 *     for.
 *   - **anything else** — a plain tab, or an install on a browser without the
 *     API: the tab itself carries a mark, in its name and on its icon
 *     (`../../theme/chrome.ts`, which owns both halves of that).
 *
 * Never both. `setAppBadge` in a tab is ignored by every browser that
 * implements it, so a page that also wrote the title would be a page whose
 * dot depended on an implementation detail; and a standalone window's title
 * bar showing "● olai" beside a dock icon already carrying the number is the
 * same news twice. What decides is one pure function, {@link channelFor}, so
 * "which one is this" is asserted rather than watched for.
 *
 * The count reaches the app badge and not the tab, deliberately: a badge is a
 * number by contract, and a tab wears a MARK (`../../theme/chrome.ts`, which
 * owns both halves of what a tab is). The count that matters is one gesture
 * away in either case, because looking is what clears this.
 *
 * A browser that refuses to badge is warned about on the console, once, and
 * never throws: this is the third of three ways a person is told, and the
 * first two have already happened by the time it runs.
 */

import { grumble } from "../../grumble.ts"
import { markWaiting } from "../../theme/chrome.ts"

/** Which of the two channels a page in this shape uses. */
export type Channel = "app" | "tab"

/** The rule, whole: the installed icon when there is one to badge, the tab's
 *  own furniture otherwise. Exported for the unit test — what a browser is
 *  running as cannot be arranged in one. */
export const channelFor = (badging: boolean, installed: boolean): Channel =>
  badging && installed ? "app" : "tab"

/**
 * Whether this page is running as an INSTALLED app rather than in a tab.
 *
 * `display-mode` covers every way a manifest can ask to be opened —
 * `standalone` is what olai's manifest names, and the other three are what a
 * browser may give instead — and `navigator.standalone` is iOS's own answer,
 * which predates the media query and is still the only one Safari on a home
 * screen gives.
 */
const installed = (): boolean => {
  const legacy = (navigator as { standalone?: boolean }).standalone === true
  if (legacy) return true
  return ["standalone", "minimal-ui", "fullscreen", "window-controls-overlay"].some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  )
}

/** Its own key, so a badging refusal cannot be silenced by an unrelated one
 *  and cannot silence one — `../../grumble.ts`. */
const noBadge = (cause: unknown): void => {
  grumble(
    "app-badge",
    "olai: this browser would not badge the app icon, so the tab's own mark is all there is",
    cause,
  )
}

/**
 * Carry `count` questions on the icon, or clear it with `0`.
 *
 * Idempotent by construction — it writes what the reading says every time
 * rather than tracking what it wrote — so a caller may hand it the same number
 * on every frame.
 */
export const wear = (count: number): void => {
  const badging = "setAppBadge" in navigator
  if (channelFor(badging, installed()) === "app") {
    const nav = navigator as {
      setAppBadge?: (count?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    const asked = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
    void asked?.catch(noBadge)
    return
  }
  markWaiting(count > 0)
}
