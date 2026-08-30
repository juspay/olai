/**
 * THE APP'S CLOCKS, as a leaf reads them.
 *
 * The furniture arrives ONCE, at the mount (`./mount.tsx`), and every face
 * reads it from here. A CONTEXT rather than a prop threaded down, and the
 * reason is the shape of what draws: the CI faces are mounted by `@olai/web`'s
 * property drawer, against a signature the drawer owns
 * (`./app.ts`'s `ChipContext`) — so there is no call site between the mount and
 * the chip for a prop to travel through. Widening the drawer's signature to
 * carry a plugin's furniture would be the seam learning what a tenant needs,
 * which is the one thing the seam exists not to do.
 *
 * ## The fallback ticks nothing, and that is the honest default
 *
 * A face drawn with no mount above it is a face on a page that has no CI half —
 * every unit test, and every consumer that is not the app. It gets a clock that
 * reads the wall once and never moves, plus the three spellings as the plain
 * arithmetic they are. Nothing here throws, because a missing provider is not a
 * fault: it is the state a tab with no odu on the wire is in, and that state
 * already has to work.
 *
 * What it deliberately does NOT do is invent olai's duration REGISTER. The
 * words come from the app because they are the app's — the same ladder the
 * pomodoro pill and the uptime chip speak — and a fallback that spelled its own
 * would be a second vocabulary on a page nobody is looking at, waiting to be
 * copied onto one somebody is (`./app.ts`'s header argues this in full).
 */

import { createContext, type JSX, useContext } from "solid-js"

import type { OduClocks } from "./app.ts"

const ClocksContext = createContext<OduClocks>()

/** A second, in the units the ladders below are written in — declared here so
 *  the still clock's own arithmetic and the app's constant cannot be two
 *  numbers on this side of the wall. */
const SECOND = 1_000

/** The still clock — see the header. Deliberately plain: no interval, no gate,
 *  no disposal, because there is nothing here to keep alive. */
const STILL: OduClocks = {
  SECOND,
  createTicking: () => {
    const at = Date.now()
    return () => at
  },
  createNow: () => {
    const at = Date.now()
    return () => at
  },
  wordsOf: (seconds) => `${Math.max(0, Math.round(seconds))}s`,
  exactOf: (seconds) => `${Math.max(0, Math.round(seconds))}s`,
  tickingOf: (elapsedMs) => `${Math.max(0, Math.round(elapsedMs / SECOND))}s`,
}

export const useClocks = (): OduClocks => useContext(ClocksContext) ?? STILL

/** Hand the app's clocks to every face under here. Mounted once per tab by
 *  `./mount.tsx` and by nothing else. */
export function ClocksProvider(props: {
  readonly clocks: OduClocks
  readonly children: JSX.Element
}): JSX.Element {
  return (
    <ClocksContext.Provider value={props.clocks}>
      {props.children}
    </ClocksContext.Provider>
  )
}
