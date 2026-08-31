/**
 * The ⏱ chip at a row's far hand: how long the work TOOK, or how long it has
 * been GOING — the face deliberately concise, the HOVER telling the whole
 * story.
 *
 * THE TWO STATES THE ROW CAN BE IN, drawn differently because they read
 * differently (`projects/olai/prototypes/timing-mock.html`, ruled):
 *
 *   - a SETTLED row — `done` or `cancelled` — wears the quiet chip, always
 *     drawn, never ticking: the span the record itself reports, derived on
 *     the side that holds the set (@olai/format's `tookOf`) and read off the
 *     row here. `⏱ 2h 34m`, the same muted register every other fact beside
 *     a title takes;
 *   - a DOING row ticks, pomodoro-style: bank plus live round — the
 *     closed rounds banked `worked` into the record — settled, queued or
 *     un-started, each where its `doing` came off — the current round's instant
 *     crossed the wire with the row, and the clock is the reader's own
 *     (`./took.ts` — the uptime chip's seam, worn by the second). The
 *     accented pill: work in flight is the one thing in a tree worth
 *     finding at a glance, which is why the glyph's accent and this chip's
 *     are one ink.
 *
 * AND THE TWO STATES THAT DRAW NOTHING. A bullet is not a task, so it carries
 * neither mark nor span; a `done` with NO `started` — the todo→done jump, and
 * every node settled before olai stamped anything — has no span to tell, and
 * drawing nothing is how the chip says so (falling back to `created` would
 * measure the node's age, never the work).
 *
 * THE RECORD IS THE ONLY TELLING THE CHIP TAKES. The mark is read off it with
 * the format's own `storedMarker` — exactly as the row's glyph and its
 * `data-status` read it (`@olai/format`'s `Derived.status` is
 * `storedMarker` of the shown record, so a caller-passed status would be one
 * fact spelled twice, and a mirror's target is already followed either way).
 *
 * THE HOVER IS THIS APP's OWN TIP, never the platform's `title` — the same
 * move the waiting glyph and the uptime pill made: the chip hugs the row's
 * RIGHT edge, which is the exact place a platform tooltip runs off the
 * window (`../../Tip.tsx` is the tip built for it), and the story below is
 * more than a sentence. The visually-hidden copy says the same words, so
 * the hover is never the only telling (`./took.ts`'s `liveStoryOf` /
 * `settledStoryOf` — the rounds the record still windows, in order, the
 * bank where it can only sum them).
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
 * (`../../NodeLine.tsx` says whose filler that is). Nothing here picks anything —
 * a chip that opened a box would be a verb, and the span is a readout.
 */

import { type RegularNode, storedMarker, tookOf } from "@olai/format"
import { Match, Switch } from "solid-js"

import { instantOf } from "../../clock.ts"
import { TESTID } from "../../testids.ts"
import { Tip } from "../../Tip.tsx"
import { createNow, liveOf, liveStoryOf, roundOf, settledStoryOf, tickingOf, wordsOf } from "./took.ts"

/** The quiet register both halves of the chip share — the ¶-counter's own:
 *  mono, reading-size, muted. */
const CHIP = "shrink-0 rounded-full px-2 font-mono text-xs"

/** A settled span recedes with its row: a finished one is legible and out of
 *  the way, and a called-off one is already the dimmest thing on the line. */
const SETTLED = `${CHIP} text-muted bg-desk`

/** Work in flight takes the app's ACCENT, exactly as its glyph does
 *  (`../../marks.tsx` argues the one-colour ruling): the pill is where a ticking
 *  number lives, and the tabular figures keep it from shimmying as it moves. */
const GOING = `${CHIP} text-accent bg-accent/10 tabular-nums`

/** The tick itself, in the doing arm alone — so only a row that can move
 *  keeps a clock. The start is KNOWN parseable — the arm below matches on
 *  that — so the fallback here is a type narrowing, not a case: a hand-wrote
 *  `started` the parse refuses draws no chip at all. The figure is the
 *  honest sum ({@link liveOf}): the BANKED rounds the settles counted plus
 *  this one, ticking — so a re-started row reads the work, never the pause
 *  it sat out. */
function GoingChip(props: { readonly started: string; readonly worked: number | undefined }) {
  const now = createNow(() => props.started)
  const banked = () => props.worked ?? 0
  const story = () => liveStoryOf(props.worked, props.started, now()).join("\n")
  return (
    <Tip text={story()}>
      <span
        class={GOING}
        data-testid={TESTID.took}
        data-status="doing"
        data-started={props.started}
      >
        ⏱ {tickingOf(liveOf(banked(), instantOf(props.started) ?? now(), now()))}
        <span class="sr-only">{story()}</span>
      </span>
    </Tip>
  )
}

export function TookChip(props: {
  /** The record the row SHOWS — a placement is already followed: a mirror's
   *  row wears its target's span and its target's tick, like every other
   *  fact on this line. */
  readonly node: RegularNode
}) {
  /** The settled span, when there is one: whole seconds, already derived —
   *  `undefined` for the jump-to-done, for a bullet, and for work still
   *  running, and WRAPPED, because the answer can honestly be 0 (header). */
  const took = () => {
    const seconds = tookOf(props.node)
    return seconds === undefined ? undefined : { seconds }
  }
  return (
    <Switch>
      <Match
        when={storedMarker(props.node) === "doing" &&
            props.node.started !== undefined &&
            instantOf(props.node.started) !== null
          ? props.node.started
          : undefined}
      >
        {(started) => <GoingChip started={started()} worked={props.node.worked} />}
      </Match>
      <Match when={took()}>
        {/* Read off the accessor, NEVER destructured out of it: the arm fires
            once per falsy→truthy crossing, and a hand edit or another agent
            landing under this page moves the seconds UNDER the wrapper — a
            destructured read would be this client's own promise (the page
            follows the files without a reload) quietly dropped. */}
        {(chip) => {
          const story = () => {
            const mark = storedMarker(props.node)
            return settledStoryOf({
              took: chip().seconds,
              banked: props.node.worked,
              // The record's own shape is read once, at this edge — the
              // undated `true`, a buried stamp, an unreadable end all land
              // as NO round (`./took.ts`'s roundOf), never as a word in a
              // sentence.
              round: roundOf(
                props.node.started,
                mark === "done" || mark === "cancelled" ? props.node[mark] : undefined,
              ),
            }).join("\n")
          }
          return (
            <Tip text={story()}>
              <span
                class={SETTLED}
                data-testid={TESTID.took}
                data-status={storedMarker(props.node)}
                data-took={chip().seconds}
              >
                ⏱ {wordsOf(chip().seconds)}
                <span class="sr-only">{story()}</span>
              </span>
            </Tip>
          )
        }}
      </Match>
    </Switch>
  )
}
