import { Effect, Scope } from "effect"

/** AN APPEND-ONLY TABLE OF SCOPE-HELD ENTRIES, read in registration order. */
export interface Roster<V> {
  readonly hold: (value: V) => Effect.Effect<void, never, Scope.Scope>
  /** Every entry held right now, in the order they were made. */
  readonly read: () => ReadonlyArray<V>
}

export const roster = <V>(changed?: () => void): Roster<V> => {
  const held = new Map<symbol, V>()
  let copy: ReadonlyArray<V> | null = null
  return {
    hold: (value) =>
      Effect.acquireRelease(
        Effect.suspend(() => {
          const at = Symbol()
          held.set(at, value)
          copy = null
          try {
            changed?.()
          } catch (refused) {
            held.delete(at)
            copy = null
            return Effect.die(refused)
          }
          return Effect.succeed(at)
        }),
        (at) =>
          Effect.sync(() => {
            held.delete(at)
            copy = null
            changed?.()
          }),
      ).pipe(Effect.asVoid),
    read: () => copy ??= [...held.values()],
  }
}

export interface Registry<K, V> {
  readonly claim: (
    key: K,
    value: V,
    refuse: (held: V) => string,
  ) => Effect.Effect<void, never, Scope.Scope>
  /** Every entry held right now, in claim order. */
  readonly read: () => ReadonlyMap<K, V>
}

export const registry = <K, V>(changed?: () => void): Registry<K, V> => {
  const table = new Map<K, V>()
  let copy: ReadonlyMap<K, V> | null = null
  return {
    claim: (key, value, refuse) =>
      Effect.acquireRelease(
        Effect.suspend(() => {
          const already = table.get(key)
          if (already !== undefined) return Effect.die(new Error(refuse(already)))
          table.set(key, value)
          copy = null
          try {
            changed?.()
          } catch (refused) {
            // THE ENTRY GOES BEFORE THE FAILURE DOES.
            table.delete(key)
            copy = null
            return Effect.die(refused)
          }
          return Effect.succeed(key)
        }),
        (key) =>
          Effect.sync(() => {
            table.delete(key)
            copy = null
            changed?.()
          }),
      ).pipe(Effect.asVoid),
    read: () => copy ??= new Map(table),
  }
}
