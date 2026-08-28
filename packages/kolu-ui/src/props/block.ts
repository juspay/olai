/**
 * THE BLOCK SEAM, as this package reads it.
 *
 * `@olai/web` owns the property drawer, its block table and the contract every
 * block wears — a fact line reachable as `[data-testid="prop"][data-key=…]`,
 * with the drawer's own handle on it. This package renders ONE block, and it
 * has to wear that contract without being able to import the drawer.
 *
 * So the shape is written here structurally and the drawer satisfies it. That
 * is the same pin `./KoluUi.tsx` uses for the surface client and for the same
 * reason: what a module is handed should be what it reads, a suite can stand
 * one up by hand, and neither side imports the other's composition.
 *
 * ## Why the chrome comes through rather than being restated
 *
 * The testid strings and the handle are the RUN'S, not this block's. A block
 * that spelled `"prop"` itself would be a second spelling of the drawer's
 * contract, free to drift the day the drawer changed it — and the drawer's own
 * suite would still be green, because the block it broke lives in another
 * package now. Handing them through means there is one spelling and the
 * compiler carries it across the wall.
 */

import type { JSX } from "solid-js"

/** One property, as the drawer hands it over. */
export interface BlockEntry {
  readonly key: string
  /** What it says, as ONE string — a list joined by commas, exactly as the
   *  drawer has always drawn it. */
  readonly value: string
}

/** The drawer's own furniture, so a block wears the run's contract rather than
 *  a copy of it. */
export interface BlockChrome {
  /** The key half of the fact line, with the drawer's editor gesture on it. */
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  /** `data-testid` for the fact line — the drawer's contract, spelled once. */
  readonly factId: string
  /** `data-testid` for the value half. */
  readonly valueId: string
}

/** What a block renderer is handed. */
export interface BlockContext {
  readonly entry: BlockEntry
  /** Open this property's editor — `undefined` where the run is read-only, and
   *  then no half of the block is a button. */
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}
