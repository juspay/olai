import type {} from "./slots.ts"
/** Layout owns the panel and viewer placements; contributors supply their faces. */
import { createMemo, Show } from "solid-js"

import { only } from "@olai/web/client/plugins/runtime.ts"

/**
 * ONE FACE OR NONE — what a single-occupancy slot draws, said once.
 *
 * `only` rather than a walk, because "there is at most one" is the thing those
 * slots exist to say: a second plugin taking the seat is refused at the moment
 * it registers, in the runtime's own words, and lands that plugin `failed` with
 * the first one's face untouched. So there is nothing to arbitrate here.
 *
 * Nothing at all where nobody has taken it, which is a state and not a gap: a
 * serve running no chat draws the outliner alone, a serve running no identity
 * row draws no chip. That is what `--plugins=` is for.
 *
 * A HELPER RATHER THAN TWO COPIES, and the two exports below stay two exports:
 * the NAMES are the app's placement vocabulary — `AppHeader.tsx` puts one of
 * them in the bar's last seat and `App.tsx` puts the other in the dock — and
 * what a seat DOES with its occupant is one behaviour, so it is written once.
 * The two would only ever diverge by one of them arbitrating, which is exactly
 * what these slots are keyed to make impossible.
 */
function Seat(props: { readonly slot: "app.panel" | "app.viewer" }) {
  const taken = createMemo(() => only(props.slot))
  return (
    <Show when={taken()}>
      {(seat) => {
        const Face = seat().face
        return <Face />
      }}
    </Show>
  )
}

/** THE PANEL ON THE RIGHT, and there is one — the dock a conversation lives
 *  in, on a serve that composed a chat row. */
export function PluginPanel() {
  return <Seat slot="app.panel" />
}

/**
 * WHO IS LOOKING — the bar's LAST seat, and there is one.
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
  return <Seat slot="app.viewer" />
}

