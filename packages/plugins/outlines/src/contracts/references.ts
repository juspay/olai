/** Static outline readings. Consumers declare this service; provider withdrawal
 * restores the absent adapters without dropping the consumer’s own state. */
import { createMemo, type Accessor } from "solid-js"
import { serviceTag } from "@olai/plugin-api/contracts"

export interface Declared {
  /** Display title, separate from the resolved identity used for navigation. */
  readonly title: (id: string) => string | null
  readonly named: (id: string) => string | null
  readonly want: (ids: ReadonlyArray<string>) => void
  readonly told: (id: string) => string | null | undefined
}
/** A node's canonical file, `null` when no node has the id, an `Error` when the
 *  outline cannot be asked, or `undefined` until it has answered. */
export type Home = string | null | Error | undefined
export interface References {
  readonly reveal: (pane: string, id: string) => boolean
  /** A reading owned by the caller; the provider re-asks on its own wire. */
  readonly home: (id: string) => Accessor<Home>
  readonly focused: Accessor<string | null>
  readonly declare: (failure?: (message: string, ids: ReadonlyArray<string>) => void) => Declared
  readonly failure: Accessor<string | null>
}
export const references = serviceTag<References>("outlines.references")

const absent: Declared = { title: () => null, named: () => null, want: () => {}, told: () => undefined }

/** One declaration over whichever provider the caller is holding — re-made when
 *  the provider arrives or leaves, so a panel that outlived an outline row asks
 *  the new one. */
export const declaredFrom = (
  provider: Accessor<References | undefined>,
  failure?: (message: string, ids: ReadonlyArray<string>) => void,
): Declared => {
  const reader = createMemo(() => provider()?.declare(failure) ?? absent)
  return { title: id => reader().title(id), named: id => reader().named(id), want: ids => reader().want(ids), told: id => reader().told(id) }
}

/** ...and what the outline could not name, or nothing. */
export const failureFrom = (
  provider: Accessor<References | undefined>,
): Accessor<string | null> => () => provider()?.failure() ?? null
