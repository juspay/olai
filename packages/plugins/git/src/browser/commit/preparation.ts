import { batch, createSignal } from "solid-js"

export const preparation = {
  typed: createSignal<string | null>(null),
  dropped: createSignal<ReadonlySet<string>>(new Set()),
}

export const submittedPreparation = (): (() => void) => {
  const submittedIn = repository
  const typed = preparation.typed[0]()
  const dropped = preparation.dropped[0]()
  return () => {
    if (repository !== submittedIn || preparation.typed[0]() !== typed || preparation.dropped[0]() !== dropped) return
    preparation.typed[1](null)
    preparation.dropped[1](new Set<string>())
  }
}


let repository: string | undefined
let owner: object | undefined
export const prepareForRepository = (identity: string): (() => void) => {
  if (owner !== undefined) throw new Error("commit preparation already has an owner")
  const token = {}
  owner = token
  if (repository !== identity) {
    repository = identity
    batch(() => { preparation.typed[1](null); preparation.dropped[1](new Set<string>()) })
  }
  return () => { if (owner === token) owner = undefined }
}
