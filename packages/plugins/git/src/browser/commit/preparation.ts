/** A tab's prepared commit survives closing the panel and plugin rebuilds. */
import { batch, createSignal } from "solid-js"

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


// Remember identity without retaining a released vault capability. A panel or
// git restart keeps the same vault; replacing the vault drops path selections.
let repository: WeakRef<object> | undefined
export const prepareForRepository = (directory: object): void => {
  if (repository?.deref() === directory) return
  repository = new WeakRef(directory)
  batch(() => { preparation.typed[1](null); preparation.dropped[1](new Set<string>()) })
}
