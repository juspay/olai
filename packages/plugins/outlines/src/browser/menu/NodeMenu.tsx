import { Show } from "solid-js"
import { Dynamic } from "solid-js/web"

import type { MenuEntry } from "./action.ts"
import { dropdownNow, menuFailure, menuReady } from "./chunk.ts"
import type { MenuDoor } from "./door.ts"
import { Dots } from "./Dots.tsx"
import { MenuSaid } from "./MenuSaid.tsx"
import { createPicking } from "./picking.ts"
import type { Said } from "@olai/web/client/saying.ts"

export function NodeMenu(props: {
  readonly actions: ReadonlyArray<MenuEntry>
  readonly door: MenuDoor
}) {
  const picking = createPicking()
  const pick = picking.pick

  const said = (): Said | null => {
    const failed = props.door.armed() ? menuFailure() : undefined
    return failed === undefined
      ? picking.said()
      : { tone: "alarm", text: `The menu didn’t load. Reload the page to try again. (${failed.message})` }
  }

  return (
    <div class="absolute inset-y-0 left-0 w-0 shrink-0 md:relative md:w-auto">
      <Show
        when={props.door.armed() && menuReady()}
        fallback={<Dots onArm={props.door.show} />}
      >
        <Dynamic
          component={dropdownNow()}
          actions={props.actions}
          door={props.door}
          onPick={pick}
        />
      </Show>
      <Show when={said()}>{message => <MenuSaid said={message()} />}</Show>
    </div>
  )
}
