/**
 * THE CLAUDE CODE ENGINE'S BROWSER HALF — two faces, and both are a drawing ABOUT
 * this engine.
 *
 * ## Why an engine has a browser half at all
 *
 * Because a drawing about a plugin belongs where somebody knows what the plugin
 * IS, and `packages/bundle/src/fence.test.ts` holds that as an equality rather
 * than a preference: no general package spells a plugin's name in code. So this
 * engine's MARK and its SENTENCE on the face drawn when the machine has no agent
 * at all are both registered from here, where the old shape had a `MARKS` table
 * and a `WHERE_FROM` record inside `@olai/web` keyed by a closed union of three.
 *
 * WHAT IS NOT REGISTERED FROM HERE is the words of this engine's row in the
 * *which agent?* question, and the reason is the rule above read the other way:
 * that row says this engine's `name`, the server sends exactly that per
 * installed agent, and core drawing a string it was handed spells nothing.
 *
 * What core keeps is the SHAPE — the sixteen-unit box, the list, the order —
 * because those are facts about the columns these are read in rather than about
 * the engine. What arrives from here is the words and the
 * strokes.
 *
 * ## The chunk, and what a serve without this row costs
 *
 * Nothing. This module is evaluated only when the roster names `claude`: its
 * chunk is fetched then and not before, its fiber is mounted then, and the
 * registration below unwinds by itself if the roster stops naming it. So
 * `--plugins=opencode,pi` is a tab with none of them in it, in the same sense
 * that it is a serve with no row for this engine and no probe of one.
 *
 * ## NO `surface`, which is the one way this half differs from a tenant's
 *
 * `BrowserHalf.surface` is what the tab DIALS a sibling by, and an engine
 * composes no sibling ({@link ./index.ts} says why). So this chunk is mounted
 * and never dialled, and `../../../web/src/client/wire.ts`'s `surfaceMapOf`
 * leaves it out of the map it redials with.
 */

import { definePlugin, Slots } from "@olai/plugin-api"
import { Effect } from "effect"

import { ClaudeMark } from "./browser/Mark.tsx"
import { AgentInstall } from "./browser/rows.tsx"
import { name } from "./index.ts"

export { name }

export default definePlugin({
  name,
  needs: [Slots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    // THE MARK, hung under this plugin's own word — which is the engine's id, so
    // the panel finds it by the same string it already has for "who is this
    // conversation with". The key is never an argument: the slot service stamps
    // it from the registry binding, so a plugin cannot hang a face under
    // another's name.
    yield* slots.register("chat.speaker.mark", ClaudeMark)
    // ...AND THIS ENGINE'S ROW ON THE NO-AGENT FACE: the sentence the panel
    // draws when this machine has no agent at all. Core keeps the SHAPE — the
    // list, the mark beside each row, the link's element — and a plugin the
    // roster does not name registers nothing, which is what makes `--plugins`
    // draw a panel with nothing of this engine anywhere in it.
    //
    // THERE IS NO PICKER-ROW FACE BESIDE IT. A picker row's words are this
    // engine's `name`, which the server already sends per installed agent, so
    // a face for it would be a second author for one string.
    yield* slots.register("chat.agent.install", AgentInstall)
  }),
})
