/** Renderer clock factories allocate timers in the consuming Solid owner.
 * Publishing these functions allocates no timer or permanent observer. */
import type { AppClocks } from "@olai/plugin-api"
import { createTicking, MINUTE, SECOND } from "@olai/web/client/clock.ts"
import { createNow, exactOf, tickingOf, wordsOf } from "@olai/web/client/live/duration/took.ts"

export const clocks: AppClocks = {
  SECOND,
  MINUTE,
  createTicking,
  createNow,
  wordsOf,
  exactOf,
  tickingOf,
}

