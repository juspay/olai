/**
 * The agenda's line of time, from what has slipped to what recedes.
 *
 * One list, keyed by the DAY — the only thing about a rung that does not move.
 * Every revision the store publishes mints these afresh and `For` compares by
 * reference, so each day would be torn down and rebuilt every frame, taking the
 * keyed rows inside it (and the note a reader had expanded) with it. That is the
 * failure ../Tree.tsx and ../day/DayGroups.tsx are both written against, and it
 * is the reasoning `agenda-spine` said had to hold for whatever replaced them.
 *
 * The rungs ABUT: their spacing lives in padding inside each one, never in a
 * margin between them, which is what lets each paint its own stretch of the line
 * and still read as one line (./spine.ts).
 *
 * Nothing here decides anything. Where a day sits, how far away it feels, how
 * long the silence before it is and what ink it takes are all `@olai/format`'s
 * (`feltOn`, `quietBetween`), assembled by `rungsOf` one file over.
 */

import type { Agenda } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo, Show } from "solid-js"

import { TESTID } from "../testids.ts"
import { Day } from "./Day.tsx"
import { SPINE_LINE } from "./gutter.ts"
import { rungsOf, TAIL, tailOf } from "./spine.ts"

export function Spine(props: {
  readonly agenda: Agenda
  /** Today, so now can be a place on the line. Printed verbatim nowhere here —
   *  the day it names says itself in words (./Day.tsx). */
  readonly today: string
}) {
  // MEMOISED, because the list is read twice on the way to the screen — once
  // for the days and once for the tail's ink — and a plain accessor would
  // assemble the whole line for each of them, every frame the store publishes.
  const rungs = createMemo(() => rungsOf(props.agenda, props.today))

  return (
    <div data-testid={TESTID.agendaSpine}>
      <Key each={rungs()} by={(rung) => rung.day.date}>
        {(rung) => <Day rung={rung()} />}
      </Key>

      {/* Past the last day the directory knows about, the line runs out. It is
          the same fade the page opens with, the other way round: time does not
          stop where an outline stops having anything to say about it. */}
      <Show when={rungs().at(-1)}>
        {(last) => (
          <div class={`relative ${TAIL}`} aria-hidden="true">
            <span class={SPINE_LINE} style={{ background: tailOf(last().felt.tone) }} />
          </div>
        )}
      </Show>
    </div>
  )
}
