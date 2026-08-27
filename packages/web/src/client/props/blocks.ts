/**
 * THE BLOCK SEAM — a property whose renderer OWNS ITS ROW.
 *
 * A run of chips is the right drawing for the thing a property almost always
 * is: a short fact, inline, several to a line. It is the wrong drawing for a
 * property whose value stands for something with a face of its own — a live
 * terminal, a build, a person — where the useful rendering is a BLOCK: its own
 * row, its own layout, its own component.
 *
 * So the drawer stops asking "is this the terminal key?" and asks the general
 * question instead: DOES THIS PROPERTY HAVE A BLOCK RENDERER? One lookup, one
 * default, and a property that has no block draws as the chip it always did.
 * The terminal door is the seam's first consumer and deliberately not its
 * shape: nothing here mentions padi, a dot, or a fleet.
 *
 * ## Keyed on the KEY today, on the declared KIND tomorrow
 *
 * {@link BLOCKS} is a table from a property key to a renderer, because a key is
 * what a vault declares today. The day typed properties land, what a block is
 * chosen by becomes the declared kind and this table's KEY TYPE changes — one
 * lookup, in one file, and no renderer and no call site moves. That is the
 * whole reason the seam is a table rather than a branch in the drawer: the
 * migration the roadmap keeps deferring costs a line here instead of a diff
 * through the drawing code.
 *
 * ## Three rules a block must satisfy, and they are the chip's own
 *
 * A block draws only where a chip would have drawn the same fact:
 *
 *   - **not a SYSTEM entry.** Those are fields with verbs of their own, and
 *     they are excluded everywhere else for that reason.
 *   - **one value.** A key holding three values is three facts, and a renderer
 *     that owns a row cannot report on three of them; the run of text it always
 *     was is the honest drawing (`./door.ts`'s wrong-door rule, one module
 *     over).
 *   - **not being EDITED.** A block is the READ face of a property and the chip
 *     is the WRITE face: while a value is open in an editor it draws as a chip,
 *     in the run, with the same box every other property is typed in. That is
 *     what stops every future block renderer from having to grow its own text
 *     box, and it is why {@link layOut} takes `editing`.
 *
 * ## Where a block sits
 *
 * BELOW THE RUN, in the file's own key order among the other blocks. Not
 * interleaved: a run is one wrapping line and a block is a row, so interleaving
 * would cut the line into fragments whose `+` affordance and add-chip have no
 * single end to sit at. The precedent is in `./PropsDrawer.tsx` already — the
 * snapshot pane and the said line both belong to one chip and both hang off the
 * DRAWER, under the run, for exactly this reason.
 */

import type { JSX } from "solid-js"

import { TERMINAL_KEY } from "@olai/surface"

import type { Entry } from "./drawer.ts"

/**
 * What a block renderer is handed.
 *
 * The ENTRY and one verb, deliberately: a renderer that needed the node, the
 * page or the wire would be a renderer the drawer has to know something about,
 * and the point of the seam is that it does not. Everything else a block needs
 * it reads from a context of its own — which is what `./fleet.tsx` already is
 * for the terminal block.
 */
export interface BlockContext {
  readonly entry: Entry
  /** Open this property's editor — `undefined` where the run is read-only, and
   *  then no half of the block is a button. */
  readonly onOpen?: () => void
  /**
   * THE RUN'S OWN CONTRACT, handed to the block rather than spelled by it.
   *
   * A block must wear the fact line every property wears —
   * `[data-testid="prop"][data-key=…]` with the drawer's handle on it — and
   * blocks live in other packages now (`@olai/kolu-ui`'s terminal door is the
   * first). A block that spelled `"prop"` itself would be a second spelling of
   * this drawer's contract, free to drift the day the drawer changed it, with
   * the drawer's own suite still green because the block it broke is somewhere
   * else. So the drawer hands its furniture across and there is one spelling.
   */
  readonly chrome: BlockChrome
}

/** What a block is handed to wear the run's contract — see {@link BlockContext}. */
export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}


/** A property renderer that owns its row. */
export type PropBlock = (context: BlockContext) => JSX.Element

/**
 * WHICH PROPERTIES DRAW AS BLOCKS.
 *
 * Registered rather than imported by the drawer, so adding one is this line and
 * a component — the drawer is closed to modification and open to extension,
 * which is the whole of what "a custom block render" buys.
 */
const BLOCKS = new Map<string, PropBlock>()

/** Register a block renderer for a property key. Called once per renderer, at
 *  module load, from the module that owns the component. */
export const registerBlock = (key: string, block: PropBlock): void => {
  BLOCKS.set(key, block)
}

/** The key the terminal door hangs off, re-exported so a registration reads in
 *  one line and the constant still has one home (`@olai/surface`). */
export { TERMINAL_KEY }

/** The renderer for one entry, or `undefined` where it draws as a chip. The
 *  three rules are here rather than in the drawer so every future block gets
 *  them without restating them. */
export const blockFor = (entry: Entry): PropBlock | undefined => {
  if (entry.system) return undefined
  if (entry.values.length !== 1) return undefined
  return BLOCKS.get(entry.key)
}

/** One block, ready to draw: the entry and the renderer that owns its row. */
export interface Laid {
  /** What draws inline, in the file's own key order — the ordinary chip run. */
  readonly run: ReadonlyArray<Entry>
  /** What owns a row, in the file's own key order, below the run. */
  readonly blocks: ReadonlyArray<{ readonly entry: Entry; readonly block: PropBlock }>
}

/**
 * The entries, cut into what draws inline and what owns a row.
 *
 * `editing` is the key currently open in an editor, and it draws as a chip
 * wherever it would otherwise have been a block — the read/write split the
 * header states, spelled in the one place that decides which is which.
 */
export const layOut = (
  entries: ReadonlyArray<Entry>,
  editing?: string,
): Laid => {
  const run: Entry[] = []
  const blocks: { entry: Entry; block: PropBlock }[] = []
  for (const entry of entries) {
    const block = entry.key === editing ? undefined : blockFor(entry)
    if (block === undefined) run.push(entry)
    else blocks.push({ entry, block })
  }
  return { run, blocks }
}
