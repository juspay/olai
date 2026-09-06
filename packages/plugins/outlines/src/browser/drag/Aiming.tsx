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

import { Match, Switch } from "solid-js"

import type { Aim } from "./aim.ts"
import { DropLine } from "./DropLine.tsx"
import { DropRefusal } from "./Refusal.tsx"

export function Aiming(props: { readonly aim: Aim | null }) {
  return (
    <Switch>
      {/* The arms narrow by projecting the half each one draws, which is what
          lets `<Match>` hand it over already typed — `../narrow.ts`'s `only`
          is the same move for a value that is never absent, and this one is. */}
      <Match when={props.aim?.kind === "drop" ? props.aim.landing : undefined}>
        {(landing) => <DropLine landing={landing()} />}
      </Match>
      <Match when={props.aim?.kind === "refused" ? props.aim.refusal : undefined}>
        {(refusal) => <DropRefusal refusal={refusal()} />}
      </Match>
    </Switch>
  )
}
