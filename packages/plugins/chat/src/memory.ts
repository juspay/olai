/** An activation's transient conversation/model cache. No disk note is read or
 * written: a fresh activation starts empty. Durable heard and wake records
 * keep their own local-state adapters. */
import type { Memory, MemorySnapshot } from "@kolu/acp-client"
import { Effect } from "effect"

/** A legible field in the durable heard and wake records. */
export const word = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null

export const volatile = (): Memory => {
  let held: MemorySnapshot | null = null
  return {
    recall: Effect.sync(() => held),
    remember: next => Effect.sync(() => { held = next }),
  }
}
