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
      directory: Effect.fail({ _tag: "StateFailure", why: "mail keeps no local directory" }),
    },
    now: () => current,
  }
}
