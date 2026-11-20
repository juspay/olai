import type { Memory, MemorySnapshot } from "@kolu/acp-client"
import { Effect } from "effect"

export const volatile = (): Memory => {
  let held: MemorySnapshot | null = null
  return {
    recall: Effect.sync(() => held),
    remember: next => Effect.sync(() => { held = next }),
  }
}
