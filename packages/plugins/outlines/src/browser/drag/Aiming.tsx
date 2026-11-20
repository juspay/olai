import { Match, Switch } from "solid-js"

import type { Aim } from "./aim.ts"
import { DropLine } from "./DropLine.tsx"
import { DropRefusal } from "./Refusal.tsx"

export function Aiming(props: { readonly aim: Aim | null }) {
  return (
    <Switch>
      <Match when={props.aim?.kind === "drop" ? props.aim.landing : undefined}>
        {(landing) => <DropLine landing={landing()} />}
      </Match>
      <Match when={props.aim?.kind === "refused" ? props.aim.refusal : undefined}>
        {(refusal) => <DropRefusal refusal={refusal()} />}
      </Match>
    </Switch>
  )
}
