/**
 * SEARCH'S BROWSER HALF — the header's box, and nothing else.
 *
 * It used to be imported by `@olai/web`'s `AppHeader.tsx`. It is a slot
 * registration now, in the bar's LEAD seat: first in the right-hand cluster,
 * the one control there that may shrink to nothing, and the one seat the shell
 * draws OUTSIDE its desktop gate — because on a phone this same door is a 44px
 * magnifier that opens the ⌘K palette, and a bar seat with no phone arm is not
 * what this face is. A serve that does not name this row never fetches this
 * chunk, and the tab draws no box at either width.
 *
 * ## What stayed in `@olai/web`, and why that is not half a move
 *
 * The shortlist kit — `Shortlist`, `Result`, `nodes`, `cursor`, `props`,
 * `place`, `Count` — is CORE FURNITURE, and it was already shared by four core
 * doors before this row existed: the ⌘K palette, the chat composer's `@` list,
 * the edges panel and the move picker. Moving it here would have made core
 * import a plugin, which the fence refuses, or moved those four doors into
 * slots, which is phase 18's lane. So this face draws with the shell's own
 * furniture exactly as it did when it lived in the shell — which is what
 * `@olai/web`'s `./client/*` door is for — and those four doors go on calling
 * `search.nodes`, which with this row off answers them with the refusal the
 * server writes (`@olai/ops`' `NO_SEARCH`) and which each of them already knows
 * how to draw.
 */

import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { HeaderSearch } from "./browser/HeaderSearch.tsx"
import { name } from "./index.ts"

export { name } from "./index.ts"

export default definePlugin({
  name,
  // NO `Wired`, and the absence is this row's whole shape on the browser side:
  // there is no sibling surface to dial. What the box asks is `search.nodes`,
  // which is CORE's member on core's own client — so this half reaches the wire
  // the way every core door does, through the shell's `createSearch`.
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    yield* slots.register("app.header", { place: "lead", body: HeaderSearch })
  }),
})
