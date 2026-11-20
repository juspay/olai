import type { JSX } from "solid-js"


export interface AppClocks {
  /**
   * WHAT DAY IT IS, in the reader's own time zone, as the ISO text the format
   * stores. An ACCESSOR, because today MOVES — at the next local midnight, and
   * whenever a sleeping tab comes back.
   */
  readonly today: () => string
  /** The ladders' units, read rather than re-typed: a readout spelling `1000`
   *  would be a second answer to what a second is. */
  readonly SECOND: number
  readonly MINUTE: number
  /** A clock that re-reads itself every `every` ms for as long as `when` says
   *  there is anything to time. The GATE is the half a bare `setInterval`
   *  cannot have and the DISPOSAL is the half a hand-rolled one forgets, which
   *  is the whole reason this crosses instead of being written a third time. */
  readonly createTicking: (every: number, when?: () => boolean) => () => number
  /** ...and the TWO-SPEED one a live duration wears: by the second while the
   *  second digit is the register, by the minute once it is not. It takes the
   *  stamp in EITHER encoding — ISO text or milliseconds — because the app's
   *  own `instantOf` is where those stop being two questions. */
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

/** THE CHROME PILL'S LOOK — the geometry the app's bar is a fixed height for.
 *  The dot's colour is not here: it is the state's tone, painted from
 *  `olai-plugin-layout/slots`' one table.
 *
 *  CLASSES rather than a component, because what a readout draws INSIDE the
 *  pill is the plugin's (a dot, a word, a second word in the warning ink) and
 *  only the box is the bar's. A component would have had to grow a slot per
 *  tenant; a shape that is only ever `class={app.pill.PILL}` cannot. */
export interface PillLook {
  readonly PILL: string
  readonly DOT: string
}

/**
 * A PANEL THAT HANGS OFF A CHROME PILL — whether it is up, where it sits, and
 * the one focus cycle the trigger and the panel make between them. The app
 * hands the WHOLE thing rather than its parts: the portal, the layer, the
 * anchor's style keys and the `tabindex="-1"` the focus cycle requires.
 */
export interface AppPopover {
  readonly open: () => boolean
  readonly toggle: () => void
  /** Put it away WITHOUT the caret walking back to the trigger — for a link
   *  inside the panel that is about to navigate. */
  readonly close: () => void
  /** `ref` on the control that opens it. */
  readonly setTrigger: (el: HTMLElement | undefined) => void
  /** The panel itself: portalled, placed against the trigger, layered, and
   *  drawn only while open. What goes IN it is the plugin's; the box is the
   *  bar's. */
  readonly Panel: (props: {
    readonly testid: string
    readonly label: string
    readonly children: JSX.Element
  }) => JSX.Element
}

/** A DOOR ONTO A SERVED FILE — the app's router and its address grammar, as the
 *  one thing a plugin actually wants out of them.
 *
 *  A plugin handed the router's `Link` and the address builder separately would
 *  hold two of the app's names to make one link; handed this, it holds none.
 *  The split-pane press, the modifier rules and what a route spells in the URL
 *  stay entirely the app's. */
export type FileLink = (props: {
  /** The served path, as the vault spells it. */
  readonly at?: string
  readonly file: string
  readonly class?: string
  readonly testid?: string
  readonly label: string
  /** The sentence a pointer gets over the link, drawn by the app's own tip.
   *  Never the only copy of anything: `label` above is what a reader who does
   *  not hover is owed. */
  readonly tip?: string
  readonly children: JSX.Element
}) => JSX.Element







/**
 * WHAT THE PLUGIN'S OWN FACE IS — the mark the panel draws beside a row a
 * plugin wrote. A plugin that hangs none is drawn with a plain generic, and
 * never another plugin's mark.
 *
 * It answers with the SHAPES and not a whole `<svg>`: a `<g>` of paths in a
 * `0 0 16 16` box, `currentColor` throughout, so a column of marks is one size
 * and one stroke weight.
 *
 * A mark whose shapes are an EXISTING ASSET may open a nested viewport inside
 * the `<g>`:
 *
 * ```tsx
 * <g>
 *   <svg x="0" y="0" width="100%" height="100%"
 *        viewBox={MARK_VIEWBOX} preserveAspectRatio="xMidYMid meet"
 *        innerHTML={…} />
 * </g>
 * ```
 *
 * Such a mark carries its own palette, so it will not dim with a muted row or
 * invert with the theme.
 *
 * A mark that declares an `id` owns its uniqueness PER INSTANCE: SVG ids are
 * global to the DOM document and the mark is drawn once per row, so the id is
 * minted at the plugin's own render (`createUniqueId`).
 */
export type PluginMark = () => JSX.Element

export type { JSX }
