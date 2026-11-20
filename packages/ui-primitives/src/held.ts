import { createSignal, type Accessor } from "solid-js"

export interface Held<T> {
  readonly hold: (value: T) => () => void
  readonly read: Accessor<T | undefined>
}

export const heldService = <T,>(): Held<T> => {
  const [held, setHeld] = createSignal<{ readonly value: T } | undefined>()
  return {
    hold: (value) => {
      const own = { value }
      setHeld(own)
      return () => { if (held() === own) setHeld(undefined) }
    },
    read: () => held()?.value,
  }
}
