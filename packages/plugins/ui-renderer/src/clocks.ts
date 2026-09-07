/** Renderer clock factories allocate timers in the consuming Solid owner.
 * Publishing these functions allocates no timer or permanent observer. */
import type { AppClocks } from "@olai/plugin-api"
import { createTicking, MINUTE, SECOND } from "@olai/web/client/clock.ts"
import { createNow, exactOf, tickingOf, wordsOf } from "@olai/web/client/duration.ts"

/** The renderer's clock, as its `clocks` component minted it — see
 *  `./browser.tsx`, which is the activation that owns the timer behind it. */
export const clocksOver = (today: () => string): AppClocks => ({
  today,
  SECOND,
  MINUTE,
  createTicking,
  createNow,
  wordsOf,
  exactOf,
  tickingOf,
})

