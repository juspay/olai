import { linkPreviews } from "olai-plugin-navigation/contract"
import { noteLine } from "olai-plugin-markdown/contract"
import { NoteLine } from "./browser/agents/NoteLine.tsx"
import { BESIDE, type BesideDoor } from "./beside.ts"
import { drawnIn } from "./browser/agents/beside.ts"
import { chatRouteOf } from "./browser/agents/route.ts"
import { ChatLinkPreview, previewNode } from "./browser/LinkPreview.tsx"
import { Landings } from "@olai/plugin-api"
import { holdLandings } from "./browser/landings.ts"
import { OPENS_KIND, SESSION_KIND } from "./binding.ts"
import { browserManagement } from "@olai/surface/management"
import { holdPluginRoster } from "./browser/plugin-roster.ts"
import type {} from "olai-plugin-navigation/slots"
import type {} from "olai-plugin-outlines/slots"
import type {} from "olai-plugin-sidebar/slots"
import { slotContracts } from "./slots.ts"
import type { Attention, AttentionRow } from "./attention.ts"
import type { Route } from "olai-plugin-navigation/routes"
import { itemKey, itemOf } from "@olai/format"
import {Clocks} from "@olai/plugin-api"
import {fileAccess} from "olai-plugin-vault/contract"
import { definePlugin, Faces, Slots, Wired, Offers } from "@olai/plugin-api"
import { Effect } from "effect"

import { Standing } from "./browser/agents/Standing.tsx"
import { createFolding, holdFolding } from "./browser/agents/folding.ts"
import { createCloses, holdCloses } from "./browser/agents/closing.ts"
import { createDrawnTitles, holdDrawnTitles } from "./browser/agents/called.ts"
import { createHistory, holdHistory } from "./browser/agents/history.ts"
import { NeedsYou, Chats } from "./browser/agents/Agents.tsx"
import { AgentsProvider, createAgents, useAgents } from "./browser/agents/answered.tsx"
import { rowVerbs } from "./browser/verbs.tsx"
import { agentAboveOf } from "./browser/agents/above.ts"
import { focusAgent } from "./browser/agents/focus.ts"
import { CrumbMark } from "./browser/agents/AgentAbove.tsx"
import { trackCamera } from "./browser/chat/camera.ts"
import { Fold } from "./browser/agents/Fold.tsx"
import { PageHead, PageFoot } from "./browser/agents/Page.tsx"
import { ChatPage } from "./browser/agents/ChatPage.tsx"
import { chatPage } from "./browser/agents/route.ts"
import { defineSelfDrawnPage } from "olai-plugin-navigation/routes"
import { browserState as outlineBrowser } from "olai-plugin-outlines/contract"
import { holdPages } from "./browser/pages.ts"
import { agentReadings, createAgentReadings, holdAgentReadings } from "./browser/agents/reading.ts"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { createAgentPalette } from "./browser/agents/AgentPalette.ts"
import { navigation as navigationService, paletteAdapters, paletteControl } from "olai-plugin-navigation/contract"
import { holdNavigation, holdPalette, navigation as heldNavigation } from "./browser/navigation.ts"
import { holdFaces } from "./browser/faces.ts"
import { readings } from "olai-plugin-search/reading"
import { holdReading } from "./browser/search.ts"
import { references as outlineReferences } from "olai-plugin-outlines/references"
import { holdReferences } from "./browser/references.ts"
import { holdServed, servedDirectory } from "./browser/vault.ts"
import { holdKindReader } from "./browser/kinds.ts"
import { deployment as appDeployment } from "olai-plugin-layout/contract"
import { holdDeployment } from "./browser/deployment.ts"
import { enginesService } from "./browser/engines.tsx"
import { type ChatClient, holdChatWire } from "./browser/wire.ts"


export { name, surface } from "./wire.ts"
import { name } from "./wire.ts"

const SECTION = "Chats"

export default definePlugin({
  name,
  needs: [Landings, Faces, Slots, Wired, Offers, fileAccess, Clocks, rendererSlots],
  apply: Effect.gen(function*() {
    const landingTable = yield* Landings
    yield* Effect.acquireRelease(Effect.sync(() => holdLandings(landingTable)), stop => Effect.sync(stop))
    const slots = yield* Slots
    const faces = yield* Faces
    const wired = yield* Wired
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(served)), stop => Effect.sync(stop))
    const renderer = yield* rendererSlots
    yield* Effect.acquireRelease(Effect.sync(() => holdKindReader(renderer.read)), stop => Effect.sync(stop))

    yield* holdChatWire(() => wired.client() as ChatClient)
    yield* holdFaces(faces)
    const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const agents = createAgents()
      const folding = createFolding()
      return {
        dispose, agents, engines: enginesService(agents), readings: createAgentReadings(agents), folding, history: createHistory(),
        closes: createCloses(),
        titles: createDrawnTitles(),
        isCurrent: (route: Route, row: AttentionRow) => isCurrent(servedDirectory()?.claims(), route, row, folding.unfolded(row.id)),
      }
    })), state => Effect.sync(state.dispose))
    yield* Effect.acquireRelease(Effect.sync(() => holdAgentReadings(state.readings)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdFolding(state.folding)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdCloses(state.closes)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdDrawnTitles(state.titles)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdHistory(state.history)), stop => Effect.sync(stop))
    yield* (yield* Offers).own("state", () => state satisfies Attention)

    yield* Effect.acquireRelease(Effect.sync(trackCamera), stop => Effect.sync(stop))
    yield* slots.register("outline.row.fold", props => <AgentsProvider value={state.agents}><Fold {...props} /></AgentsProvider>, {
      children: [slotContracts["conversation.wake"], slotContracts["tool.reply"], slotContracts["delivery.mark"]],
    })
    yield* slots.register("outline.page.head", props => <AgentsProvider value={state.agents}><PageHead {...props} /></AgentsProvider>)
    yield* slots.register("outline.page.foot", props => <AgentsProvider value={state.agents}><PageFoot {...props} /></AgentsProvider>)
    yield* slots.register(
      "app.route",
      defineSelfDrawnPage(chatPage, props => <AgentsProvider value={state.agents}><ChatPage item={props.value} /></AgentsProvider>),
    )
    yield* slots.register("sidebar.section", { said: "Needs you", body: () => <AgentsProvider value={state.agents}><NeedsYou /></AgentsProvider> })
    yield* slots.register("sidebar.section", { said: SECTION, body: () => <AgentsProvider value={state.agents}><Chats /></AgentsProvider> })
    const palette = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      let value!: ReturnType<typeof createAgentPalette>
      createComponent(AgentsProvider, { value: state.agents, get children() {
        value = createAgentPalette(useAgents())
        return null
      } })
      return { value, dispose }
    })), owner => Effect.sync(owner.dispose))
    yield* (yield* rendererSlots).contribute(linkPreviews, {
      priority: 100,
      matches: route => {
        const key = previewNode(route)
        const agent = key === undefined ? undefined : state.agents.chatOf(itemOf(key))
        return agent?.session != null
      },
      Preview: props => <ChatLinkPreview route={props.route} roster={state.agents} />,
    })
    yield* (yield* rendererSlots).contribute(paletteAdapters, palette.value)
    yield* (yield* rendererSlots).contribute(noteLine,
      props => <AgentsProvider value={state.agents}><NoteLine path={props.path} /></AgentsProvider>)
    yield* slots.register("outline.row.placement", SESSION_KIND, { inRows: false })
    yield* slots.register("outline.row.placement", OPENS_KIND, { inRows: false })
    yield* slots.register("outline.row.aside", props => <AgentsProvider value={state.agents}><Standing {...props} /></AgentsProvider>)
    yield* slots.register("outline.crumb.aside", props => <AgentsProvider value={state.agents}><CrumbMark {...props} /></AgentsProvider>)
    yield* slots.register("outline.row.action", node => rowVerbs(node, state.agents, id => agentAboveOf(id, state.agents), (row) => {
      const nav = heldNavigation()
      if (nav === undefined) return "Can't open this right now"
      focusAgent(nav, row)
    }))
    yield* (yield* Offers).own("engines", () => state.engines)
  }),
})

import { speaker } from "./browser/viewer.ts"
import { alertsChannel } from "olai-plugin-alerts/contract"
import { holdChannel } from "./browser/channel.ts"
import { configurationPanel } from "olai-plugin-plugin-inspector/contract"
import { holdPluginsDoor } from "./browser/plugins-door.ts"
import { createAttention } from "./browser/chat/attention/attention.ts"
import { createComponent, createRoot, Show } from "solid-js"
import { shell as appShell, thumbs as thumbSeats } from "olai-plugin-layout/contract"
import { ChatsThumb } from "./browser/agents/ChatsThumb.tsx"
import { isCurrent } from "./browser/agents/here.ts"
import { holdShell } from "./browser/shell.ts"
export const components = {
  thumb: definePlugin({ name: "thumb", needs: [appShell, rendererSlots], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    const renderer = yield* rendererSlots
    const roster = () => agentReadings()?.agents
    yield* renderer.contribute(thumbSeats, {
      order: 30,
      body: () => <Show when={roster()}>{agents => <AgentsProvider value={agents()}><ChatsThumb reveal={geometry.revealSidebar} /></AgentsProvider>}</Show>,
    })
  }) }),
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
  deployment: definePlugin({ name: "deployment", needs: [appDeployment], apply: Effect.gen(function*() {
    const named = yield* appDeployment
    yield* Effect.acquireRelease(Effect.sync(() => holdDeployment(named)), stop => Effect.sync(stop))
  }) }),
  navigation: definePlugin({ name: "navigation", needs: [navigationService, paletteControl, Offers], apply: Effect.gen(function*() {
    const control = yield* paletteControl
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(control)), stop => Effect.sync(stop))
    const router = yield* navigationService
    yield* Effect.acquireRelease(Effect.sync(() => holdNavigation(router)), stop => Effect.sync(stop))
    yield* (yield* Offers).own(BESIDE, () => ({
      open: ({ item, from }) => {
        const at = drawnIn(router.panes().map((pane) => pane.route()), itemKey(item))
        if (at !== null) router.focus(at)
        else router.openRight(from, chatRouteOf(item))
      },
    } satisfies BesideDoor))
  }) }),
  matcher: definePlugin({ name: "matcher", needs: [readings], apply: Effect.gen(function*() {
    const reading = yield* readings
    yield* Effect.acquireRelease(Effect.sync(() => holdReading(reading)), stop => Effect.sync(stop))
  }) }),
  references: definePlugin({ name: "references", needs: [outlineReferences], apply: Effect.gen(function*() {
    const value = yield* outlineReferences
    yield* Effect.acquireRelease(Effect.sync(() => holdReferences(value)), stop => Effect.sync(stop))
  }) }),
  pages: definePlugin({ name: "pages", needs: [outlineBrowser], apply: Effect.gen(function*() {
    const value = yield* outlineBrowser
    yield* Effect.acquireRelease(Effect.sync(() => holdPages(value.readings)), stop => Effect.sync(stop))
  }) }),
  recomposing: definePlugin({ name: "recomposing", needs: [browserManagement], apply: Effect.gen(function*() {
    const management = yield* browserManagement
    yield* Effect.acquireRelease(Effect.sync(() => holdPluginRoster(management)), stop => Effect.sync(stop))
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
  plugins: definePlugin({ name: "plugins", needs: [configurationPanel], apply: Effect.gen(function*() {
    const panel = yield* configurationPanel
    yield* Effect.acquireRelease(Effect.sync(() => holdPluginsDoor(panel)), stop => Effect.sync(stop))
  }) }),
  speaker,
}
