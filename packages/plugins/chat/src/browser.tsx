/**
 * CHAT'S BROWSER HALF — the right panel, the sidebar's agents section, the door
 * on an agent row, the two verbs on a row's `•••`, and the palette's `>`.
 *
 * ## What this module replaced
 *
 * `@olai/web`'s `App.tsx` imported `chat/Panel.tsx` and wrapped the whole tree
 * in `agents/answered.tsx`'s provider; its `AppHeader.tsx` drew the toggle; its
 * `NodeBody.tsx` drew the door on every row; its `Sidebar.tsx` drew the roster
 * section; its `menu/verbs.ts` carried two agent verbs in core's own catalogue
 * and its `palette/Palette.tsx` carried a `>` prefix that sent a line to an ACP
 * agent. Every one of those was core naming a feature, and the tab could not
 * turn any of it off.
 *
 * They are SLOT REGISTRATIONS now. The shell declares where a face may hang and
 * keeps the box — the panel's width and its open/closed preference, the
 * sidebar's region and heading shape, the menu's order and its dividers, the
 * palette's input and where a refusal is drawn — and this plugin brings the
 * words and the drawings. A serve run with `--plugins=` composes no chat row, so
 * this module is never fetched, and the tab draws the outliner alone with no
 * panel, no section, no door and no `>`.
 *
 * ## THE WIRE IS THIS PLUGIN'S OWN, and it is held rather than threaded
 *
 * `Wired` hands over the sibling client the framework minted for this plugin,
 * keyed by the word the registry bound the fiber under. Thirty modules in this
 * package read it at module scope, so it is put in a holder here and read
 * through {@link ./browser/wire.ts} — the same arrangement `@olai/web` keeps for
 * core's own client, and the header there argues why the holder holds the READ
 * rather than the client.
 *
 * ## THREE SERVICES AND NOT SIX, and the three that are missing are the point
 *
 * `Bar`, `Clocks` and `Links` are the app's chrome furniture, and a tenant that
 * draws a pill or a duration names them. This half does not: its faces are the
 * PANEL and the sidebar's own region, which draw with the app's layout, its type
 * scale and its router directly — through the shell door (`@olai/web`'s
 * `./client/*`), which is what that door is for and what the manifest there
 * argues at length.
 *
 * They were named here for one revision and spent nowhere, under a comment
 * saying the fiber should wait for the app to have furnished them. That is a
 * coefficient as a WISH: `needs` is what the runtime holds a fiber PENDING
 * against, so naming a service this half never reads makes the panel wait on a
 * provider it has no use for — the exact opposite of what the declaration is,
 * and a thing that would go wrong silently the day the app furnished one of them
 * later than it does now.
 *
 * ## WHAT THIS HALF READS OF OTHER PLUGINS
 *
 * Two slots, through `Faces`: the mark a plugin's delivered sentence wears in a
 * transcript (`delivery.mark`), and each engine's install sentence on the
 * face drawn when this machine has no agent at all (`engine.install`). That
 * is the door the plan named — a plugin reading what other plugins hung — and it
 * is a read with no privilege in it: the same three reads the tab has, off the
 * same tables, with each registering plugin's word beside its face and no way to
 * write one.
 */

import { definePlugin, Faces, Slots, Wired } from "@olai/plugin-api"
import { Effect } from "effect"

import { AgentDoor } from "./browser/agents/Door.tsx"
import { Agents } from "./browser/agents/Agents.tsx"
import { AgentsProvider } from "./browser/agents/answered.tsx"
import { askCommand, CommandContext, rowVerbs } from "./browser/verbs.tsx"
import { trackCamera } from "./browser/chat/camera.ts"
import { Panel, Toggle } from "./browser/chat/Panel.tsx"
import { holdFaces } from "./browser/faces.ts"
import { type ChatClient, holdChatWire } from "./browser/wire.ts"

/** THE WIRE IDENTITY, on this door too — and `surface` is the load-bearing
 *  half of it. The tab builds its sibling map out of what each browser half
 *  EXPORTS (`@olai/web`'s `client/wire.ts`), so a half that names no surface is
 *  read as an ENGINE — a plugin that composes no sibling because what it
 *  contributes travels on somebody else's cell — and is mounted without being
 *  dialled. For a plugin that HAS members that is not a smaller tab: its own
 *  client is `null`, and the first face to read one throws inside a render.
 *  `@olai/bundle`'s `composition.test.ts` holds the two doors equal. */
export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

/** THE SIDEBAR'S HEADING, in this plugin's words. Core keeps the region, the
 *  heading's type and the column's height budget; what a plugin brings is what
 *  it is called and what is under it. */
const SECTION = "Agents"

export default definePlugin({
  name,
  needs: [Faces, Slots, Wired],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const faces = yield* Faces
    const wired = yield* Wired

    // THIS PLUGIN'S OWN MEMBERS, held for the thirty modules that read them at
    // module scope — see `./browser/wire.ts`.
    holdChatWire(() => wired.client() as ChatClient)
    // ...AND WHAT OTHER PLUGINS HUNG, for the two slots this panel is the
    // reader of.
    holdFaces(faces)

    // WHETHER THIS DEVICE HAS A CAMERA to offer, watched once for the tab. It
    // was `main.tsx`'s, a statement in core's boot about a control that only
    // this panel's composer draws.
    trackCamera()

    // THE PANEL, in the seat the shell reserves for one. What travels with it is
    // everything that draws INSIDE that seat — the dock, the mobile sheet, the
    // minimized strip and the wake strip — because none of those is a bar
    // readout in this app's geometry and all of them are the panel positioning
    // itself in what it was given.
    yield* slots.register("app.panel", Panel)
    // ...and the control in the bar that opens and shuts it.
    yield* slots.register("app.header", { place: "cluster", body: Toggle })
    // THE ROSTER SECTION, under the app's own sidebar regions.
    yield* slots.register("sidebar.section", { said: SECTION, body: Agents })
    // THE DOOR ON A ROW — drawn on every row and answering nothing on nearly
    // all of them, which is one map read against a roster this half subscribes
    // to once for the whole tab (`./browser/agents/answered.tsx` argues what
    // subscribing per row would cost).
    yield* slots.register("outline.row.door", AgentDoor)
    // THE VERBS ON A ROW'S `•••`, as a READING rather than a list — the count
    // is one per installed engine plus the ask, and the roster that decides it
    // arrives after this fiber does (`./browser/verbs.tsx` argues both).
    yield* slots.register("outline.row.action", rowVerbs)
    yield* slots.register("app.command", askCommand)
    // THE ROSTER, AS ONE SUBSCRIPTION AROUND THE WHOLE PAGE. It is a mount
    // rather than a face because what it provides is a CONTEXT: the sidebar's
    // section draws the whole of it, every outline row asks whether its node is
    // on it, and the panel's header asks what the node its conversation belongs
    // to is called — three readers with the whole app between them.
    yield* slots.register("app.mount", (props) => (
      <CommandContext><AgentsProvider>{props.children}</AgentsProvider></CommandContext>
    ))
  }),
})
