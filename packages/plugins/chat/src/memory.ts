/** An activation's transient conversation/model cache. No disk note is read or
 * written: a fresh activation starts empty. Durable heard and wake records
 * keep their own local-state adapters. */
import { Effect } from "effect"
import type { MemoryFailure } from "./local.ts"
export { MemoryFailure } from "./local.ts"

export interface MemorySnapshot {
  /** Which agent the conversation is with ({@link ./agents/roster.ts}). */
  readonly agent: string
  readonly session: string
  /** `null` for "nothing says" — a conversation entered but never heard of
   *  again, a file written by an olai that only remembered sessions, or a
   *  panel that has not yet been told which model it is on. */
  readonly model: string | null
}

/**
 * Two verbs and a record: the socket, and everything volatile is behind it.
 *
 * What CHANGES back there is where the file lives, what is in it, whether it is
 * one file or a row of an index, and whether a machine keeps this at all. What
 * does not is the pair below — the panel says where it is and what it is on,
 * and a boot asks what that was. That asymmetry is the whole reason this is an
 * interface with one implementation rather than two `fs` calls in `agent.ts`.
 */
export interface Memory {
  /** What this directory's panel was last in and on, or `null` when nothing
   *  has been written down yet. */
  readonly recall: Effect.Effect<MemorySnapshot | null, MemoryFailure>
  /** ... and writing it down. Called whenever the panel enters a conversation
   *  or learns that the model under it has moved, which are the only two
   *  moments the answer changes. */
  readonly remember: (held: MemorySnapshot) => Effect.Effect<void, MemoryFailure>
}


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
