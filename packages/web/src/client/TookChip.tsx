/**
 * The ⏱ chip at a row's far hand: how long the work TOOK, or how long it has
 * been GOING.
 *
 * THE TWO STATES THE ROW CAN BE IN, drawn differently because they read
 * differently (`projects/olai/prototypes/timing-mock.html`, ruled):
 *
 *   - a SETTLED row — `done` or `cancelled` — wears the quiet chip, always
 *     drawn, never ticking: the span the record itself reports, derived on
 *     the side that holds the set (@olai/format's `tookOf`) and read off the
 *     row here. `⏱ 2h 34m`, the same muted register every other fact beside
 *     a title takes;
 *   - a DOING row ticks, pomodoro-style: the instant crossed the wire with
 *     the row, and the clock is the reader's own (`./took.ts` — the uptime
 *     chip's seam, worn by the second). The accented pill: work in flight is
 *     the one thing in a tree worth finding at a glance, which is why the
 *     glyph's accent and this chip's are one ink.
 *
 * AND THE TWO STATES THAT DRAW NOTHING. A bullet is not a task, so it carries
 * neither mark nor span; a `done` with NO `started` — the todo→done jump, and
 * every node settled before olai stamped anything — has no span to tell, and
 * drawing nothing is how the chip says so (falling back to `created` would
 * measure the node's age, never the work). The mark is the caller's to say
 * rather than this file's to re-derive: the row already read it — a mirror's
 * row says what its target says, and the chip follows it, like every other
 * fact on this line.
 *
 * ONE TRUTHINESS PIT, pin-sharp: a row set doing and settled inside the same
 * second has a span of `0` — a real one, and the prototype says the chip
 * wears it ("a `0s` does appear — honest places read zero"). `<Match
 * when={0}>` is how a face like this goes quietly dark, so the settled
 * lookup returns the seconds WRAPPED: the jump-to-done silence is
 * `undefined`, a real zero is `{ seconds: 0 }`, and only the first draws
 * nothing.
 *
 * RIGHT-ALIGNED and not another fact in the byline: the span is the line's
 * closing figure, hugged to the end of the row after the filler that absorbs
 * it, rather than riding beside the words with the rule and the date
 * (`./NodeLine.tsx` says whose filler that is). Nothing here picks anything —
 * a chip that opened a box would be a verb, and the span is a readout.
 */

import { type RegularNode, settles, type Status, tookOf } from "@olai/format"
import { Match, Switch } from "solid-js"

import { instantOf } from "./clock.ts"
import { TESTID } from "./testids.ts"
import { createNow, tickingOf, wordsOf } from "./took.ts"

/** The quiet register both halves of the chip share — the ¶-counter's own:
 *  mono, reading-size, muted. */
const CHIP = "shrink-0 rounded-full px-2 font-mono text-xs"

/** A settled span recedes with its row: a finished one is legible and out of
 *  the way, and a called-off one is already the dimmest thing on the line. */
const SETTLED = `${CHIP} text-muted bg-desk`

/** Work in flight takes the app's ACCENT, exactly as its glyph does
 *  (`./marks.tsx` argues the one-colour ruling): the pill is where a ticking
 *  number lives, and the tabular figures keep it from shimmying as it moves. */
const GOING = `${CHIP} text-accent bg-accent/10 tabular-nums`

/** The tick itself, in the doing arm alone — so only a row that can move
 *  keeps a clock. The start is KNOWN parseable — the arm below matches on
 *  that — so the fallback here is a type narrowing, not a case: a hand-wrote
 *  `started` the parse refuses draws no chip at all. */
function GoingChip(props: { readonly started: string }) {
  const now = createNow(() => props.started)
  return (
    <span
      class={GOING}
      data-testid={TESTID.took}
      data-status="doing"
      data-started={props.started}
      title={`under way since ${props.started}`}
    >
      ⏱ {tickingOf(now() - (instantOf(props.started) ?? now()))}
    </span>
  )
}

export function TookChip(props: {
  /** The mark the row carries — the caller's read, never re-derived here:
   *  a mirror's row wears its target's span and its target's tick. */
  readonly status: Status | undefined
  /** The record the row SHOWS. */
  readonly node: RegularNode
}) {
  /** The settled span, when there is one: whole seconds, already derived —
   *  `undefined` for the jump-to-done, for a bullet, and for work still
   *  running, and WRAPPED, because the answer can honestly be 0 (header). */
  const took = () => {
    if (props.status === undefined || !settles(props.status)) return undefined
    const seconds = tookOf(props.node)
    return seconds === undefined ? undefined : { seconds }
  }
  return (
    <Switch>
      <Match
        when={props.status === "doing" &&
            props.node.started !== undefined &&
            instantOf(props.node.started) !== null
          ? props.node.started
          : undefined}
      >
        {(started) => <GoingChip started={started()} />}
      </Match>
      <Match when={took()}>
        {(chip) => {
          const { seconds } = chip()
          return (
            <span
              class={SETTLED}
              data-testid={TESTID.took}
              data-status={props.status}
              data-took={seconds}
              title={`took ${seconds}s`}
            >
              ⏱ {wordsOf(seconds)}
            </span>
          )
        }}
      </Match>
    </Switch>
  )
}
