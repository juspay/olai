/**
 * THE CLAUDE CODE ENGINE'S BROWSER HALF — its mark and its inspector row.
 *
 * A drawing about a plugin belongs where somebody knows what the plugin is.
 * The bundle fence makes that an equality: no general package spells an
 * engine's name. The mark belongs here; the picker receives this engine's
 * name and standing from the server, so it needs no second author for either.
 *
 * Chat keeps the shared shape — the mark's box, the sentence line, and the
 * optional installation link. This engine's server probe owns every word of
 * the absence reason; the browser never authors a competing static diagnosis.
 * Its optional row component consumes chat's declared service to obtain the
 * face, then registers it here. Slots stamps the calling engine's identity;
 * a shared renderer is not permission to draw into somebody else's row.
 *
 * The component, not the import, owns that acquisition. With chat absent it
 * waits, leaving the mark independent. Withdrawal releases the contribution
 * before the provider's standing and renderer disappear; return acquires the
 * new face. Nothing alive crosses the static contract door.
 *
 * This chunk is fetched only when the roster names this engine, and both
 * registrations unwind when that row leaves. There is no surface to dial:
 * an engine supplies a probe and a leg to chat, not a sibling conversation.
 */
import type {} from "olai-plugin-chat/slots"
import { engines } from "olai-plugin-chat/browser-engines"
import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import { ClaudeMark } from "./browser/Mark.tsx"
import { name } from "./index.ts"

export { name }
export const components = { row: definePlugin({ name: "row", needs: [engines, Slots],
  apply: Effect.gen(function*() {
    yield* (yield* Slots).register("plugins.row", (yield* engines).row(name))
  }),
}) }

export default definePlugin({
  name,
  needs: [Slots],
  apply: Effect.gen(function*() {
    yield* (yield* Slots).register("delivery.mark", ClaudeMark)
  }),
})
