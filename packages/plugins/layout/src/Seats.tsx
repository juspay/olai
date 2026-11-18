/** Layout owns the viewer placement; the contributor supplies its face. */
import type {} from "./slots.ts"
import { createMemo, Show } from "solid-js"

import { only } from "./faces.ts"

/**
 * WHO IS LOOKING — the bar's LAST seat, and there is one.
 *
 * ## ONE FACE OR NONE
 *
 * `only` rather than a walk, because "there is at most one" is the thing this
 * slot exists to say: a second plugin taking the seat is refused at the moment
 * it registers, in the runtime's own words, and lands that plugin `failed` with
 * the first one's face untouched. So there is nothing to arbitrate here.
 *
 * Nothing at all where nobody has taken it, which is a state and not a gap: a
 * serve running no identity row draws no chip. That is what a policy with all
 * rows off is for.
 *
 * ## Why this is not a seat in the header cluster
 *
 * Because the cluster is drawn under `desktop()` and this is not. The pills
 * beside it are about the app's HEALTH and leave the bar entirely on a phone
 * (WhatsApp's rule, and `on_a_phone.feature` asserts what is left: identity and
 * search). Who is looking is about the READER, it is last on every viewport,
 * and it survives that rule — so the shell places it OUTSIDE the desktop gate,
 * which is a fact about this app's geometry rather than something a plugin
 * should be able to be wrong about.
 *
 * With no identity row composed there is no chip, beside a server on which
 * every request is nobody. The two halves say the same thing, which is what
 * keeps the empty seat readable rather than looking like a chip that failed to
 * load.
 */
export function PluginViewer() {
  const taken = createMemo(() => only("app.viewer"))
  return (
    <Show when={taken()} keyed>
      {(seat) => {
        const Face = seat.face
        return <Face />
      }}
    </Show>
  )
}
