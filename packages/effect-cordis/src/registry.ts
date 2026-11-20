import { Effect, Scope } from "effect"

const announce = <At>(
  at: At,
  changed: (() => void) | undefined,
  undo: (at: At) => void,
): Effect.Effect<At> => {
  try {
    changed?.()
  } catch (refused) {
    undo(at)
    return Effect.die(refused)
  }
  return Effect.succeed(at)
}

export interface Roster<V> {
  readonly hold: (value: V) => Effect.Effect<void, never, Scope.Scope>
  readonly read: () => ReadonlyArray<V>
}

export const roster = <V>(changed?: () => void): Roster<V> => {
  const held = new Map<symbol, V>()
  let copy: ReadonlyArray<V> | null = null
  const forget = (at: symbol): void => {
    held.delete(at)
    copy = null
  }
  return {
    hold: (value) =>
      Effect.acquireRelease(
        Effect.suspend(() => {
          const at = Symbol()
          held.set(at, value)
          copy = null
          return announce(at, changed, forget)
        }),
        (at) =>
          Effect.sync(() => {
            forget(at)
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
  readonly read: () => ReadonlyMap<K, V>
}

export const registry = <K, V>(changed?: () => void): Registry<K, V> => {
  const table = new Map<K, V>()
  let copy: ReadonlyMap<K, V> | null = null
  const forget = (key: K): void => {
    table.delete(key)
    copy = null
  }
  return {
    claim: (key, value, refuse) =>
      Effect.acquireRelease(
        Effect.suspend(() => {
          const already = table.get(key)
          if (already !== undefined) return Effect.die(new Error(refuse(already)))
          table.set(key, value)
          copy = null
          return announce(key, changed, forget)
        }),
        (key) =>
          Effect.sync(() => {
            forget(key)
            changed?.()
          }),
      ).pipe(Effect.asVoid),
    read: () => copy ??= new Map(table),
  }
}
