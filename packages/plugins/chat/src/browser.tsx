import { SESSION_KIND } from "./binding.ts"
import type {} from "olai-plugin-layout/slots"
import type {} from "olai-plugin-navigation/slots"
import type {} from "olai-plugin-outlines/slots"
import type {} from "olai-plugin-sidebar/slots"
import { slotContracts } from "./slots.ts"
import {Clocks} from "@olai/plugin-api"
import {fileAccess} from "olai-plugin-vault/contract"
/**
 * Chat owns the activation roster, per-conversation UI, and tab-local folds.
 * Outlines owns the row and page slots; sidebar and navigation own their
 * surfaces. Each mounted fold acquires its keyed wire reading and releases it
 * when its row or slot leaves. No layout shell service is held here.
 *
 * Wired and Faces are held under this activation for chat's internal modules.
 * Cross-plugin live readings are declared services or scoped contributions;
 * naming an unused service would leave this component waiting for no reader.
 */

import { definePlugin, Faces, Slots, Wired, Offers } from "@olai/plugin-api"
import { Effect } from "effect"

import { Standing } from "./browser/agents/Standing.tsx"
import { createFolding, holdFolding } from "./browser/agents/folding.ts"
import { NeedsYou, Recent } from "./browser/agents/Agents.tsx"
import { AgentsProvider, createAgents, useAgents } from "./browser/agents/answered.tsx"
import { createAskCommand, rowVerbs } from "./browser/verbs.tsx"
import { trackCamera } from "./browser/chat/camera.ts"
import { Fold } from "./browser/agents/Fold.tsx"
import { PageHead, PageFoot } from "./browser/agents/Page.tsx"
import { browserState as outlineBrowser } from "olai-plugin-outlines/contract"
import { holdPages } from "./browser/pages.ts"
import { createAgentReadings, holdAgentReadings } from "./browser/agents/reading.ts"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createAgentPalette } from "./browser/agents/AgentPalette.ts"
import { navigation as navigationService, paletteAdapters, paletteControl } from "olai-plugin-navigation/contract"
import { holdNavigation, holdPalette } from "./browser/navigation.ts"
import { holdFaces } from "./browser/faces.ts"
import { readings } from "olai-plugin-search/reading"
import { holdReading } from "./browser/search.ts"
import { references as outlineReferences } from "olai-plugin-outlines/references"
import { holdReferences } from "./browser/references.ts"
import { holdServed } from "./browser/vault.ts"
import { deployment as appDeployment } from "olai-plugin-layout/contract"
import { holdDeployment } from "./browser/deployment.ts"
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
const SECTION = "Recent"

export default definePlugin({
  name,
  needs: [Faces, Slots, Wired, Offers, fileAccess, Clocks, rendererSlots],
  apply: Effect.gen(function*() {
    const slots = yield* Slots
    const faces = yield* Faces
    const wired = yield* Wired
    // The served directory the composer completes a path out of, held for this
    // activation (`./browser/vault.ts`).
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(served)), stop => Effect.sync(stop))

    // THIS PLUGIN'S OWN MEMBERS, held for the thirty modules that read them at
    // module scope — see `./browser/wire.ts`.
    yield* holdChatWire(() => wired.client() as ChatClient)
    // ...AND WHAT OTHER PLUGINS HUNG, for the two slots this panel is the
    // reader of — for THIS activation, cleared by identity when it stops.
    yield* holdFaces(faces)
    const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const agents = createAgents()
      return { dispose, agents, readings: createAgentReadings(agents), folding: createFolding() }
    })), state => Effect.sync(state.dispose))
    yield* Effect.acquireRelease(Effect.sync(() => holdAgentReadings(state.readings)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdFolding(state.folding)), stop => Effect.sync(stop))
    yield* (yield* Offers).own("state", () => state)


    yield* Effect.acquireRelease(Effect.sync(trackCamera), stop => Effect.sync(stop))
    yield* slots.register("outline.row.fold", props => <AgentsProvider value={state.agents}><Fold {...props} /></AgentsProvider>, {
      children: [slotContracts["delivery.mark"], slotContracts["engine.install"]],
    })
    yield* slots.register("outline.page.head", props => <AgentsProvider value={state.agents}><PageHead {...props} /></AgentsProvider>)
    // The fold registration above owns the shared conversation locations for
    // this activation. Page faces consume them too; claiming them twice would
    // refuse the activation. Reverse cleanup removes the page before that owner.
    yield* slots.register("outline.page.foot", props => <AgentsProvider value={state.agents}><PageFoot {...props} /></AgentsProvider>)
    yield* slots.register("sidebar.section", { said: "Needs you", body: () => <AgentsProvider value={state.agents}><NeedsYou /></AgentsProvider> })
    yield* slots.register("sidebar.section", { said: SECTION, body: () => <AgentsProvider value={state.agents}><Recent /></AgentsProvider> })
    const palette = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      let value!: ReturnType<typeof createAgentPalette>
      createComponent(AgentsProvider, { value: state.agents, get children() {
        value = createAgentPalette(useAgents())
        return null
      } })
      return { value, dispose }
    })), owner => Effect.sync(owner.dispose))
    yield* (yield* rendererSlots).contribute(paletteAdapters, palette.value)
    // The aside reads the activation roster once per row; only opening a fold
    // acquires a conversation. Unbound rows offer a start gesture.
    yield* slots.register("outline.row.placement", SESSION_KIND, { inRows: false })
    yield* slots.register("outline.row.aside", props => <AgentsProvider value={state.agents}><Standing {...props} /></AgentsProvider>)
    // THE VERBS ON A ROW'S `•••`, as a READING rather than a list — the count
    // is one per installed engine plus the ask, and the roster that decides it
    // arrives after this fiber does (`./browser/verbs.tsx` argues both).
    yield* slots.register("outline.row.action", node => rowVerbs(node,state.agents))

  }),
})

/** The speaker waits for identity without taking the conversation away. */
import { speaker } from "./browser/viewer.ts"
import { alertsChannel } from "olai-plugin-alerts/contract"
import { holdChannel } from "./browser/channel.ts"
import { createAttention } from "./browser/chat/attention/attention.ts"
import { createComponent, createEffect, createRoot, untrack } from "solid-js"
export const components = {
  /** What this deployment is called, DECLARED — a component of its own so a
   *  notification is raised with the bare word rather than not at all when the
   *  shell is absent (`./browser/deployment.ts`). */
  deployment: definePlugin({ name: "deployment", needs: [appDeployment], apply: Effect.gen(function*() {
    const named = yield* appDeployment
    yield* Effect.acquireRelease(Effect.sync(() => holdDeployment(named)), stop => Effect.sync(stop))
  }) }),
  navigation: definePlugin({ name: "navigation", needs: [navigationService, Slots, paletteControl], apply: Effect.gen(function*() {
    const control = yield* paletteControl
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(control)), stop => Effect.sync(stop))
    const router = yield* navigationService
    yield* Effect.acquireRelease(Effect.sync(() => holdNavigation(router)), stop => Effect.sync(stop))
    yield* (yield* Slots).register("app.command", createAskCommand())
  }) }),
  /** The matcher, DECLARED — a component of its own so the panel, the
   *  transcript and the roster keep working with no matcher mounted
   *  (`./browser/search.ts`). */
  matcher: definePlugin({ name: "matcher", needs: [readings], apply: Effect.gen(function*() {
    const reading = yield* readings
    yield* Effect.acquireRelease(Effect.sync(() => holdReading(reading)), stop => Effect.sync(stop))
  }) }),
  /** The outline's naming of a node, DECLARED — a component of its own so the
   *  transcript keeps its chips (as ids) when the outline row leaves
   *  (`./browser/references.ts`). */
  references: definePlugin({ name: "references", needs: [outlineReferences], apply: Effect.gen(function*() {
    const value = yield* outlineReferences
    yield* Effect.acquireRelease(Effect.sync(() => holdReferences(value)), stop => Effect.sync(stop))
  }) }),
  pages: definePlugin({ name: "pages", needs: [outlineBrowser], apply: Effect.gen(function*() {
    const value = yield* outlineBrowser
    yield* Effect.acquireRelease(Effect.sync(() => holdPages(value.readings)), stop => Effect.sync(stop))
  }) }),
  attention: definePlugin({ name: "attention", needs: [alertsChannel, navigationService], apply: Effect.gen(function*() {
    const router = yield* navigationService
    const channel = yield* alertsChannel
    yield* Effect.acquireRelease(Effect.sync(() => holdChannel(channel)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      createAttention(router)
      return dispose
    })), dispose => Effect.sync(dispose))
  }) }),
  speaker,
}
