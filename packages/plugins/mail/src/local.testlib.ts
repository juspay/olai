/**
 * A `LocalState` DOOR OVER ONE OBJECT A TEST OWNS — the piece two of this
 * package's test files each used to spell for themselves.
 *
 * Core's door is a file, a permit and a save chain (`@olai/server`'s
 * `localStateFor`), and none of that is what `openMemory` or the machine's
 * boot are about: what they are about is the record's SHAPE and what the arms
 * do with it. So the tests replace the file with a variable, and this is that
 * variable — one home, so the two tests cannot drift into disagreeing about
 * what a save or a load means.
 *
 * `now()` reads the object the door currently holds, which is how a test asks
 * what was WRITTEN rather than what was parsed: the two differ exactly when
 * this package's own parse is the thing under test.
 */

import type { LocalState } from "@olai/plugin-api/services"
import { Effect } from "effect"

export interface DoorOver {
  readonly door: LocalState
  readonly now: () => Record<string, unknown> | null
}

export const doorOver = (held: Record<string, unknown> | null): DoorOver => {
  let current = held
  return {
    door: {
      load: Effect.suspend(() => Effect.succeed(current)),
      save: (value) => Effect.sync(() => { current = value }),
    },
    now: () => current,
  }
}
