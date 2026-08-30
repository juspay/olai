/**
 * WHAT THIS PLUGIN READS OF THE APP — declared here, structurally, and nothing
 * else about `@olai/web` is known on this side of the wall.
 *
 * ## Why a re-declaration rather than an import
 *
 * `@olai/plugins` declares the whole furniture and `@olai/plugins` imports THIS
 * package, so importing it back would be the cycle the manifests cannot express
 * — the direction argued at length in that package's `plugin.ts` and held by its
 * `fence.test.ts` rather than by a reviewer's memory. The agreement is proved at
 * the registry's `satisfies` instead, which is the same pin `@olai/kolu-ui`'s
 * `block.ts` already keeps with the drawer's entry and `@olai/ops` keeps with
 * the surface's `Status`.
 *
 * ## Why this is the STRONGER agreement, not a concession
 *
 * A shared import would have handed this package every field the app offers.
 * What is written below is the four this plugin actually spends — and because a
 * function parameter is contravariant, the app's richer furniture satisfies this
 * narrower reading while a field asked for HERE that the app does not hand over
 * fails at the registry, naming this plugin. The chip reads what it reads, and
 * the compiler says so.
 *
 * ## Why the CLOCK crosses at all
 *
 * The chip TICKS, and the register it ticks in is the app's: a running node
 * reads `m:ss` under an hour and `2h 34m` past it, exactly as the pomodoro pill
 * beside a doing row does, because a reader who has learnt what a ticking number
 * looks like in olai should not have to learn it again because the thing ticking
 * is a test suite. A duration formatter of this package's own would be a second
 * vocabulary free to drift, with the app's suite green — `BlockChrome`'s
 * argument, applied to the one thing a live face is actually made of.
 */

import type { JSX } from "solid-js"

/** The app's clocks and duration words — see the header on why they cross.
 *  Only the six this package spends: the chip's two-speed `now`, the pane's
 *  plain second-tick, and the three spellings a span takes. */
export interface OduClocks {
  readonly SECOND: number
  readonly createTicking: (every: number, when?: () => boolean) => () => number
  readonly createNow: (
    started: () => string | number | null | undefined,
  ) => () => number
  readonly wordsOf: (seconds: number) => string
  readonly exactOf: (seconds: number) => string
  readonly tickingOf: (elapsedMs: number) => string
}

/** ...and the whole of what this plugin is handed. One field today, which is
 *  the honest shape: nothing odu draws is in the app's bar, so it asks for no
 *  pill, no popover and no door onto a file. */
export interface OduApp {
  readonly clocks: OduClocks
}

/** THE RUN'S OWN CONTRACT, as a face wears it — `@olai/web`'s `BlockChrome`,
 *  re-declared for this file's reason. Nothing here draws the handle today (the
 *  CI faces are a chip and a pane, and the run's own chip carries the fact
 *  line), so the shape is carried and not spent — which is what keeps the two
 *  face signatures one signature. */
export interface BlockChrome {
  readonly Handle: (props: {
    readonly label: string
    readonly onOpen?: () => void
  }) => JSX.Element
  readonly factId: string
  readonly valueId: string
}

/** One property, as the drawer hands it over. The CHIP reads `value` — the
 *  board's own word, which is what the server keyed the row by precisely so a
 *  browser never has to resolve a path — and nothing else. */
export interface PropEntry {
  readonly key: string
  readonly value: string
  readonly values: ReadonlyArray<string>
  readonly system: boolean
}

/** What a PANE face is handed. */
export interface BlockContext {
  readonly entry: PropEntry
  readonly onOpen?: () => void
  readonly chrome: BlockChrome
}

/** ...and what a CHIP is: the same, plus whether its pane is open and the verb
 *  that toggles it. The state is the DRAWER'S — opening a second pane closes
 *  the first, which is what a person means by pressing somewhere else, and a
 *  chip holding its own `open` could not know it. */
export interface ChipContext extends BlockContext {
  readonly opened: boolean
  readonly onToggle?: () => void
}
