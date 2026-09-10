/**
 * NAMING A NODE FROM SOMEWHERE THAT IS NOT AN OUTLINE — the contract, and
 * nothing live.
 *
 * The chat panel writes references to nodes: an armed chip carries an id and
 * wants the node's title, a reference in a delivered sentence wants to be
 * pressable, and a set of ids the outline could not name wants a line saying
 * so. All three are the OUTLINE's readings, and the panel is a different
 * package.
 *
 * ## What used to cross this door, and why it was wrong
 *
 * A Solid signal, at module scope, holding the outline's live implementation:
 * outlines' `browser.tsx` called `holdReferences(value)` and the panel's
 * components read it through `createDeclared`. The value crossed a package wall
 * as a module variable, so the runtime saw no dependency at all — chat declared
 * nothing, `plugins.inspect` reported nothing, and nothing withdrew when the
 * outline row stopped except the signal going quiet on its own good behaviour.
 * That is the audit's §2 and §12 in one file.
 *
 * The value travels on {@link references} now — a service outlines offers and
 * chat's `references` component declares. What is left here is the SHAPE and
 * the three pure adapters over an accessor a caller supplies, because the
 * absent arm is the interesting part of each of them and is worth having once
 * rather than three times in the consuming package.
 *
 * ## The absent arm is the contract, not a fallback
 *
 * A panel with no outline row mounted keeps every reference it is holding and
 * draws the ids it carries: `named` answers `null`, `want` asks nobody,
 * `showNode` does nothing and the failure line is empty. That is the same
 * reading these adapters have always had — what changed is that it is now
 * reached because a DECLARED provider is absent rather than because a module
 * variable happens to be `undefined`.
 */
import { createMemo, type Accessor } from "solid-js"
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

const absent: Declared = { named: () => null, want: () => {}, told: () => undefined }

/** One declaration over whichever provider the caller is holding — re-made when
 *  the provider arrives or leaves, so a panel that outlived an outline row asks
 *  the new one. */
export const declaredFrom = (
  provider: Accessor<References | undefined>,
  failure?: (message: string, ids: ReadonlyArray<string>) => void,
): Declared => {
  const reader = createMemo(() => provider()?.declare(failure) ?? absent)
  return { named: id => reader().named(id), want: ids => reader().want(ids), told: id => reader().told(id) }
}

/** ...and the press that shows one, which does nothing at all with no outline. */
export const showNodeFrom = (
  provider: Accessor<References | undefined>,
): ((id: string) => void) => {
  const show = createMemo(() => provider()?.showNode())
  return id => show()?.(id)
}

/** ...and what the outline could not name, or nothing. */
export const failureFrom = (
  provider: Accessor<References | undefined>,
): Accessor<string | null> => () => provider()?.failure() ?? null
