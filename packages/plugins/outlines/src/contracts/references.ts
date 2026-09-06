/** Narrow node-reference behavior. Consumers can remain mounted while outlines
 * leaves: marks retract immediately and another activation creates new readers. */
import { createMemo, createSignal, type Accessor } from "solid-js"
import { serviceTag } from "@olai/plugin-api/contracts"
export interface Declared {
  readonly named: (id: string) => string | null
  readonly want: (ids: ReadonlyArray<string>) => void
  readonly told: (id: string) => string | null | undefined
}
export interface References {
  readonly declare: (failure?: (message: string, ids: ReadonlyArray<string>) => void) => Declared
  readonly showNode: () => (id: string) => void
  readonly failure: Accessor<string | null>
}
export const references = serviceTag<References>("outlines.references")
const [active, setActive] = createSignal<References | undefined>()
export const holdReferences = (value: References): (() => void) => {
  setActive(value)
  return () => { if (active() === value) setActive(undefined) }
}
const absent: Declared = { named: () => null, want: () => {}, told: () => undefined }
export const createDeclared = (failure?: (message: string, ids: ReadonlyArray<string>) => void): Declared => {
  const reader = createMemo(() => active()?.declare(failure) ?? absent)
  return { named: id => reader().named(id), want: ids => reader().want(ids), told: id => reader().told(id) }
}
export const useShowNode = (): ((id: string) => void) => {
  const show = createMemo(() => active()?.showNode())
  return id => show()?.(id)
}
export const declaringFailure: Accessor<string | null> = () => active()?.failure() ?? null
