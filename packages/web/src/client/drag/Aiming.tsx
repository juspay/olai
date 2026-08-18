/**
 * WHAT THE DRAG PROMISES, drawn — whichever of the two answers it has.
 *
 * A page draws one thing while a row is in the air, and which thing it is is
 * the aim's own kind: a line where the row would land, or the face saying the
 * pane under the pointer cannot take it (`./aim.ts`). This is where that union
 * is spent — so no caller narrows it, no caller can draw both, and neither half
 * has to carry a `null` for the frames before the threshold is crossed.
 *
 * It is a component rather than two lines in `../edit/Editable.tsx` for that
 * reason alone: the page composing the editor is handed ONE affordance to
 * place, not a switch to keep in step with a union.
 */

import { Match, Show, Switch } from "solid-js"

import { only } from "../narrow.ts"
import type { Aim } from "./aim.ts"
import { DropLine } from "./DropLine.tsx"
import { DropRefusal } from "./Refusal.tsx"

export function Aiming(props: { readonly aim: Aim | null }) {
  return (
    <Show when={props.aim}>
      {(aim) => (
        <Switch>
          <Match when={only(aim(), "drop")}>
            {(drop) => <DropLine landing={drop().landing} />}
          </Match>
          <Match when={only(aim(), "refused")}>
            {(refused) => <DropRefusal refusal={refused().refusal} />}
          </Match>
        </Switch>
      )}
    </Show>
  )
}
