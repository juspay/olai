import type { JSX } from "solid-js"

export interface AppClocks {
  /**
   * What day it is, in the reader's own time zone, as the ISO text the format
   * stores. An ACCESSOR, because today MOVES — at the next local midnight, and
   * whenever a sleeping tab comes back.
   */
  readonly today: () => string
  readonly SECOND: number
  readonly MINUTE: number
  /** A clock that re-reads itself every `every` ms for as long as `when` says
   *  there is anything to time, and disposes with its owner. */
  readonly createTicking: (every: number, when?: () => boolean) => () => number
  /** ...and the TWO-SPEED one a live duration wears: by the second while the
   *  second digit is the register, by the minute once it is not. */
  readonly createNow: (
    started: () => string | number | null | undefined,
  ) => () => number
  /** A SETTLED span in the app's own words (`2h 34m`). */
  readonly wordsOf: (seconds: number) => string
  /** ...the same span exactly, for a hover (`2h 34m 44s`). */
  readonly exactOf: (seconds: number) => string
  /** ...and a RUNNING one in the ticking register (`2:10`). */
  readonly tickingOf: (elapsedMs: number) => string
}

export interface PillLook {
  readonly PILL: string
  readonly DOT: string
}

export interface AppPopover {
  readonly open: () => boolean
  readonly toggle: () => void
  /** Put it away without the caret walking back to the trigger. */
  readonly close: () => void
  /** `ref` on the control that opens it. */
  readonly setTrigger: (el: HTMLElement | undefined) => void
  /** The panel itself: portalled, placed against the trigger, layered, and
   *  drawn only while open. */
  readonly Panel: (props: {
    readonly testid: string
    readonly label: string
    readonly children: JSX.Element
  }) => JSX.Element
}

export type FileLink = (props: {
  /** The served path, as the vault spells it. */
  readonly at?: string
  readonly file: string
  readonly class?: string
  readonly testid?: string
  readonly label: string
  /** The sentence a pointer gets over the link, drawn by the app's own tip. */
  readonly tip?: string
  readonly children: JSX.Element
}) => JSX.Element

/**
 * The mark the panel draws beside a row a plugin wrote. It answers with the
 * SHAPES and not a whole `<svg>`: a `<g>` of paths in a `0 0 16 16` box,
 * `currentColor` throughout, so a column of marks is one size and one stroke
 * weight.
 *
 * A mark that declares an `id` owns its uniqueness PER INSTANCE: SVG ids are
 * global to the DOM document and the mark is drawn once per row, so the id is
 * minted at the plugin's own render (`createUniqueId`).
 */
export type PluginMark = () => JSX.Element

export type { JSX }
