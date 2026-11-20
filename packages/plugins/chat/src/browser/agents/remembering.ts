import { type Accessor, createEffect, createSignal } from "solid-js"

import { closedHere } from "./closing.ts"
import type { WasTied } from "./lost.ts"

interface Seen {
  readonly key: string
  readonly closes: number
  readonly was: WasTied | null
}

export const createRemembered = (input: {
  readonly key: Accessor<string>
  readonly tied: Accessor<WasTied | null>
}): Accessor<WasTied | null> => {
  const [was, setWas] = createSignal<WasTied | null>(null)
  createEffect<Seen>((seen) => {
    const key = input.key()
    const closes = closedHere(key)
    const held = input.tied()
    const first = seen === undefined || seen.key !== key
    const next = first ? held : closes > seen.closes ? null : held ?? seen.was
    setWas(next)
    return { key, closes, was: next }
  })
  return was
}
