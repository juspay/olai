import { createMemo, type Accessor } from "solid-js"
import { serviceTag } from "@olai/plugin-api/contracts"

export interface Declared {
  readonly title: (id: string) => string | null
  readonly named: (id: string) => string | null
  readonly want: (ids: ReadonlyArray<string>) => void
  readonly told: (id: string) => string | null | undefined
}
export type Home = string | null | Error | undefined
export interface References {
  readonly reveal: (pane: string, id: string) => boolean
  readonly home: (id: string) => Accessor<Home>
  readonly focused: Accessor<string | null>
  readonly declare: (failure?: (message: string, ids: ReadonlyArray<string>) => void) => Declared
  readonly failure: Accessor<string | null>
}
export const references = serviceTag<References>("outlines.references")

const absent: Declared = { title: () => null, named: () => null, want: () => {}, told: () => undefined }

export const declaredFrom = (
  provider: Accessor<References | undefined>,
  failure?: (message: string, ids: ReadonlyArray<string>) => void,
): Declared => {
  const reader = createMemo(() => provider()?.declare(failure) ?? absent)
  return { title: id => reader().title(id), named: id => reader().named(id), want: ids => reader().want(ids), told: id => reader().told(id) }
}

export const failureFrom = (
  provider: Accessor<References | undefined>,
): Accessor<string | null> => () => provider()?.failure() ?? null
