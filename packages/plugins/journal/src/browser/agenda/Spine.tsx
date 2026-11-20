import type { Agenda } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Day } from "./Day.tsx"
import { SPINE_LINE } from "./gutter.ts"
import { rungsOf, TAIL, tailOf } from "./spine.ts"

export function Spine(props: {
  readonly agenda: Agenda
  readonly today: string
}) {
  const rungs = createMemo(() => rungsOf(props.agenda, props.today))
  /** There is ALWAYS a last rung — now is always on the line (`rungsOf`) — so
   *  this is the invariant read rather than a case guarded against. */
  const ending = () => rungs()[rungs().length - 1]!.felt.tone

  return (
    <div data-testid={TESTID.agendaSpine}>
      <Key each={rungs()} by={(rung) => rung.day.date}>
        {(rung) => <Day rung={rung()} />}
      </Key>

      <div class={`relative ${TAIL}`} aria-hidden="true">
        <span class={SPINE_LINE} style={{ background: tailOf(ending()) }} />
      </div>
    </div>
  )
}
