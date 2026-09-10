/**
 * The number a directory-column entry wears — Agenda's count, and Inbox's.
 *
 * ONE COMPONENT so the two cannot drift: the ruling is that Inbox follows
 * Agenda's badge, the same unit, not a second spelling of a pill. It hides
 * at zero, which is Agenda's quiet face and Inbox's empty-inbox face, read
 * once here rather than at each of them.
 *
 * `count > 0 && paint !== ""` is two gates that agree today because
 * `markOf` never paints a chip whose count is zero (`../agenda/owed.ts`).
 * A future Agenda face that painted a legitimate zero would vanish here —
 * that is an invariant of the table, not a knob this component offers.
 */

import { Show } from "solid-js"

export function CountChip(props: {
  readonly count: number
  /** The face's paint, or empty where there is no chip — Agenda's table
   *  hands this over so "is there a mark" stays decided there. Inbox
   *  always passes the quiet paint, and zero still hides. */
  readonly paint: string
  readonly testid: string
}) {
  return (
    <Show when={props.count > 0 && props.paint !== ""}>
      <span class={`ml-auto shrink-0 ${props.paint}`} data-testid={props.testid}>
        {props.count}
      </span>
    </Show>
  )
}
