/** An activation's transient conversation/model cache. No disk note is read or
 * written: a fresh activation starts empty. Durable heard and wake records
 * keep their own local-state adapters ({@link ./local.ts}). */
import type { Memory, MemorySnapshot } from "@kolu/acp-client"
import { Effect } from "effect"

export const volatile = (): Memory => {
  let held: MemorySnapshot | null = null
  return {
    recall: Effect.sync(() => held),
    remember: next => Effect.sync(() => { held = next }),
  }
}
