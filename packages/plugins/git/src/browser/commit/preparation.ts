/** A tab's prepared commit survives closing the panel and plugin rebuilds. */
import { createSignal } from "solid-js"

export const preparation = {
  typed: createSignal<string | null>(null),
  dropped: createSignal<ReadonlySet<string>>(new Set()),
}

/** A successful reply only clears the preparation that was submitted. */
export const submittedPreparation = (): (() => void) => {
  const typed = preparation.typed[0]()
  const dropped = preparation.dropped[0]()
  return () => {
    if (preparation.typed[0]() !== typed || preparation.dropped[0]() !== dropped) return
    preparation.typed[1](null)
    preparation.dropped[1](new Set<string>())
  }
}
