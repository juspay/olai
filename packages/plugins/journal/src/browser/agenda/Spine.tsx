import type { Agenda } from "@olai/format"
import { Key } from "@solid-primitives/keyed"
import { createMemo } from "solid-js"

import { TESTID } from "../../testids.ts"
import { Day } from "./Day.tsx"
import { SPINE_LINE } from "./gutter.ts"
import { lineOf, TAIL, tailOf } from "./spine.ts"

export function Spine(props: {
  readonly agenda: Agenda
  readonly today: string
}) {
  const line = createMemo(() => lineOf(props.agenda, props.today))

  return (
    <div data-testid={TESTID.agendaSpine}>
      <Key each={line().rungs} by={(rung) => rung.day.date}>
        {(rung) => <Day rung={rung()} />}
      </Key>

      <div class={`relative ${TAIL}`} aria-hidden="true">
        <span class={SPINE_LINE} style={{ background: tailOf(line().ending) }} />
      </div>
    </div>
  )
}
