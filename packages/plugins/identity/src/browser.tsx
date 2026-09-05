/**
 * IDENTITY'S BROWSER HALF — one face, in the app's last seat.
 *
 * The chip that says who is looking used to be spelled out in
 * `@olai/web`'s `AppHeader.tsx`, under a comment about proxies and picture
 * ladders, importing a `who/` folder of six modules that were core's
 * because the reading was. The reading is a row's now, so the drawing is
 * too: what core keeps is the SEAT (`app.viewer` — last, top right, and
 * the one chip a phone's bar keeps), and what arrives from here is every
 * word and stroke in it.
 *
 * ## What it reads, and why that is still core's procedure
 *
 * `who.get`, on core's own face, answered per connection from the headers
 * the upgrade carried ({@link ./browser/asking.ts}). The value is one
 * value for THIS SOCKET and the socket is core's, so there is no sibling
 * surface here to dial — this half is mounted and never dialled, the way
 * an engine's is. What makes the answer this row's is the other end: with
 * no identity row composed, nobody stands behind the `Identity` door and
 * every request is nobody.
 *
 * ## The chunk, and what a serve without this row costs
 *
 * Nothing. This module is evaluated only when the roster names `identity`:
 * its chunk is fetched then and not before, its fiber is mounted then, and
 * the registration below unwinds by itself if the roster stops naming it —
 * so `--plugins` without it is a bar whose last seat is empty, beside a
 * server on which every request is nobody. The two halves say the same
 * thing, which is what makes the absence readable rather than a chip stuck
 * on `asking`.
 */

import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { Who } from "./browser/Who.tsx"
import { name } from "./index.ts"

export { name }

export default definePlugin({
  name,
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    // ONE FACE IN THE WHOLE APP, keyed by the slot rather than by this
    // plugin: two chips answering "who am I" in one bar is not an answer,
    // so a second row claiming this seat is refused by name at the moment
    // it registers.
    yield* slots.register("app.viewer", Who)
  }),
})
