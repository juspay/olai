import type { AppClocks } from "@olai/plugin-api"
import { createTicking, MINUTE, SECOND } from "@olai/web/client/clock.ts"
import { createNow, exactOf, tickingOf, wordsOf } from "@olai/web/client/duration.ts"

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

