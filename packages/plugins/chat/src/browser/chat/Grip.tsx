import { TESTID } from "../../testids.ts"
import { Show } from "solid-js"
import { createCarry } from "@olai/web/client/carry.ts"
import { HOVER_REVEAL } from "@olai/ui-primitives/touch.ts"
import { landings } from "../landings.ts"
import type { CarriedText } from "../../carry.ts"
export const textCarry = (text: () => string | null) => {
  const carry = createCarry(() => {
    const words = text()
    return words === null ? null : { kind: "chat.text", text: words } satisfies CarriedText
  }, landings)
  return {
    ...carry,
    touch: (event: PointerEvent) => {
      if (event.pointerType !== "touch" || text() === null) return
      if ((event.target as Element).closest("a, button, input, textarea, [data-grip]")) return
      event.stopPropagation()
      carry.grab(event)
    },
  }
}
export function Grip(props: { readonly text: string | null; readonly carry: ReturnType<typeof textCarry> }) {
  return <Show when={props.text !== null}><button type="button" aria-label="carry these words" data-grip data-testid={TESTID.chatGrip}
    class={`absolute left-0 top-0 cursor-grab text-muted ${HOVER_REVEAL}`}
    draggable={false} onDragStart={event => event.preventDefault()}
    onPointerDown={event => { event.stopPropagation(); props.carry.grab(event) }}
    onContextMenu={props.carry.heldMenu} onClick={props.carry.click}>⠿</button></Show>
}
