import { type Accessor, createContext, createSelector, createSignal, useContext } from "solid-js"

import { chainOf } from "../select/range.ts"

export interface Air {
  readonly held: Accessor<ReadonlySet<string>>
  readonly has: (record: string) => boolean
  readonly lift: (ids: ReadonlySet<string>) => void
}

const AirContext = createContext<Air>()

export const useAir = (): Air => {
  const air = useContext(AirContext) ?? ownedAir
  if (air === undefined) throw new Error("a drag consumer outside <App>")
  return air
}

export const AirProvider = AirContext.Provider

export const createAir = (): Air => {
  const [held, setHeld] = createSignal<ReadonlySet<string>>(new Set())
  return { held, has: createSelector(held, (record: string, records) => records.has(record)), lift: setHeld }
}

export const airborne = (held: ReadonlySet<string>, key: string): boolean =>
  held.size > 0 && chainOf(key).some((id) => held.has(id))

let ownedAir: Air | undefined
export const holdAir = (value: Air): (() => void) => {
  ownedAir = value
  return () => { if (ownedAir === value) ownedAir = undefined }
}
