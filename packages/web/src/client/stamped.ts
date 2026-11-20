import { type Accessor, createMemo, createSignal } from "solid-js"

export interface Stamped<V> {
  readonly value: Accessor<V>
  readonly set: (next: V) => void
  readonly edit: (change: (current: V) => V) => void
}

export const createStamped = <S, V>(
  stamp: Accessor<S>,
  fresh: (stamp: S) => V,
): Stamped<V> => {
  const start = stamp()
  const [held, setHeld] = createSignal<{ readonly stamp: S; readonly value: V }>({
    stamp: start,
    value: fresh(start),
  })

  const value = createMemo(() => {
    const current = held()
    const now = stamp()
    return current.stamp === now ? current.value : fresh(now)
  })

  const set = (next: V): void => {
    setHeld({ stamp: stamp(), value: next })
  }

  return { value, set, edit: (change) => set(change(value())) }
}
