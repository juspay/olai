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
 * WHAT THE NUMBER COUNTS is QUESTIONS, not conversations, and it is worth
 * being exact because a `3` on a dock icon reads as three chats to anybody who
 * has used another app. It is `ChatState.asking` — how many of this
 * conversation's questions are still waiting on a person — and olai's panel
 * holds ONE conversation, so "conversations awaiting" and "questions awaiting"
 * differ only in the direction of the count: three questions in the one chat,
 * never three chats. Making it read the other way would take a fact this app
 * does not have on the wire, which the roadmap item's own scope note rules
 * out. Said in the same words in `docs/chat.md` and `docs/architecture.md`.
 *
 * A browser that refuses to badge is warned about on the console, once, and
 * never throws: this is the third of three ways a person is told, and the
 * first two have already happened by the time it runs.
 *
 * `@kolu/surface-app`'s own `setAttention` does this job and is deliberately
 * NOT used, which is worth writing down rather than leaving as an unremarked
 * parallel: it is reachable only through `SurfaceAppProvider`, which this root
 * does not ride (`../../main.tsx`), and it writes BOTH channels
 * unconditionally where the ruling here is one or the other. What IS taken
 * from the framework is the predicate — see {@link installed}.
 */

import { isInstalledFromEnv } from "@kolu/surface-app/solid"

import { grumble } from "@olai/web/client/grumble.ts"
import { markWaiting } from "@olai/web/client/theme/chrome.ts"

/** Which of the two channels a page in this shape uses. */
export type Channel = "app" | "tab"

/** The rule, whole: the installed icon when there is one to badge, the tab's
 *  own furniture otherwise. Exported for the unit test — what a browser is
 *  running as cannot be arranged in one. */
export const channelFor = (badging: boolean, installed: boolean): Channel =>
  badging && installed ? "app" : "tab"

/** Every way a manifest can ask to be opened — `standalone` is what olai's
 *  names, and the other two are what a browser may give instead. */
const INSTALLED_MODES = ["standalone", "minimal-ui", "fullscreen"]

/**
 * Whether this page is running as an INSTALLED app rather than in a tab.
 *
 * THE PREDICATE IS THE FRAMEWORK'S (`isInstalledFromEnv`), over the two facts
 * it names: any installed display mode, and iOS Safari's legacy
 * `navigator.standalone`, which predates the media query and is still the only
 * answer a home screen gives there. Written here it was a SECOND answer to one
 * question, and the two had already diverged — the local copy counted
 * `window-controls-overlay` and the framework does not.
 *
 * READ ONCE. A display mode does not change under a running document in any
 * way this cares about, and `wear` is called on every reading of the
 * conversation: three `MediaQueryList` objects per call is three allocations
 * for an answer that settled when the window opened.
 */
let running: boolean | undefined

const installed = (): boolean => {
  running ??= isInstalledFromEnv({
    // Not read by `isInstalledFromEnv` — it is `canInstallFromEnv`'s field —
    // and answered honestly rather than faked, because the type asks for it.
    isSecureContext: window.isSecureContext,
    displayModeStandalone: INSTALLED_MODES.some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    ),
    navigatorStandalone: (navigator as { standalone?: boolean }).standalone === true,
  })
  return running
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

/** What the icon is wearing. The caller hands this a number on every reading
 *  of the conversation — including every focus and blur — so a count that has
 *  not moved must not be a platform call. The tab channel has the same guard
 *  one layer down (`../../theme/chrome.ts`); this is the app channel's half. */
let worn = -1

/** Carry `count` questions on the icon, or clear it with `0`. */
export const wear = (count: number): void => {
  if (count === worn) return
  worn = count
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
