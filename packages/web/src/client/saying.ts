import type { OpFailure } from "@olai/format"
import { type Accessor, createSignal, onCleanup } from "solid-js"

export interface Said {
  readonly tone: "alarm" | "aside"
  readonly text: string
  readonly kind?: OpFailure["_tag"]
}

export const SAID_MS = 6_000

export interface Saying {
  readonly said: Accessor<Said | null>
  readonly say: (message: Said | null | void) => void
}

export const createSaying = (): Saying => {
  const [said, setSaid] = createSignal<Said | null>(null)
  let clearing: ReturnType<typeof setTimeout> | undefined
  onCleanup(() => clearTimeout(clearing))

  return {
    said,
    say: (message) => {
      clearTimeout(clearing)
      const next = message ?? null
      setSaid(next)
      if (next !== null) clearing = setTimeout(() => setSaid(null), SAID_MS)
    },
  }
}
