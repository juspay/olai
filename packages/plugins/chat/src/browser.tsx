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
    // The served directory the composer completes a path out of, held for this
    // activation (`./browser/vault.ts`).
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(served)), stop => Effect.sync(stop))
    // ...and what each kind of file is drawn with, so a chat about a file
    // wears its file's mark (`./browser/kinds.ts`).
    const renderer = yield* rendererSlots
    yield* Effect.acquireRelease(Effect.sync(() => holdKindReader(renderer.read)), stop => Effect.sync(stop))

    // THIS PLUGIN'S OWN MEMBERS, held for the thirty modules that read them at
    // module scope — see `./browser/wire.ts`.
    yield* holdChatWire(() => wired.client() as ChatClient)
    // ...AND WHAT OTHER PLUGINS HUNG, for the two slots this panel is the
    // reader of — for THIS activation, cleared by identity when it stops.
    yield* holdFaces(faces)
    const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const agents = createAgents()
      const folding = createFolding()
      return {
        dispose, agents, engines: enginesService(agents), readings: createAgentReadings(agents), folding, history: createHistory(),
        // WHICH CHATS THIS READER CLOSED, for the page that would otherwise
        // offer a person their own press back (`./browser/agents/closing.ts`).
        closes: createCloses(),
        // WHICH PAGE A CHAT IS ABOUT, for a tab's dot: chat's own reading of
        // which item a page is (`./browser/agents/here.ts`).
        isCurrent: (route: Route, row: AttentionRow) => isCurrent(servedDirectory()?.claims(), route, row, folding.unfolded(row.id)),
      }
    })), state => Effect.sync(state.dispose))
    yield* Effect.acquireRelease(Effect.sync(() => holdAgentReadings(state.readings)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdFolding(state.folding)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdCloses(state.closes)), stop => Effect.sync(stop))
    // ...and the history list's own open/shut, the same owner and the same
    // lifetime as the fold beside it (`./browser/agents/history.ts`).
    yield* Effect.acquireRelease(Effect.sync(() => holdHistory(state.history)), stop => Effect.sync(stop))
    // `chat.state`, as its static door names it (`./attention.ts`): the value
    // is the whole activation state, and it must keep satisfying that shape.
    yield* (yield* Offers).own("state", () => state satisfies Attention)

    yield* Effect.acquireRelease(Effect.sync(trackCamera), stop => Effect.sync(stop))
    yield* slots.register("outline.row.fold", props => <AgentsProvider value={state.agents}><Fold {...props} /></AgentsProvider>, {
      children: [slotContracts["conversation.wake"], slotContracts["tool.reply"], slotContracts["delivery.mark"]],
    })
    yield* slots.register("outline.page.head", props => <AgentsProvider value={state.agents}><PageHead {...props} /></AgentsProvider>)
    // The fold registration above owns the shared conversation locations for
    // this activation. Page faces consume them too; claiming them twice would
    // refuse the activation. Reverse cleanup removes the page before that owner.
    yield* slots.register("outline.page.foot", props => <AgentsProvider value={state.agents}><PageFoot {...props} /></AgentsProvider>)
    // A CONVERSATION'S OWN PAGE, as a self-drawn route — the address every
    // door that opens a chat goes to (`./browser/agents/route.ts`). It is
    // registered on this row rather than in a component of its own because
    // the page is the roster's reader: with chat off there is no page, which
    // is the same sentence the seat and the fold say.
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
        // THE KEY IS THE ITEM'S, a node's id or a note's path, because a chat
        // page is addressed by either (`./browser/LinkPreview.tsx`).
        const key = previewNode(route)
        const agent = key === undefined ? undefined : state.agents.chatOf(itemOf(key))
        return agent?.session != null
      },
      Preview: props => <ChatLinkPreview route={props.route} roster={state.agents} />,
    })
    yield* (yield* rendererSlots).contribute(paletteAdapters, palette.value)
    // THE LINE AT THE TOP OF A NOTE, filled for this activation's life: how
    // the note's chat stands and the way into it beside the page, or the box
    // that starts one. Chat off, and the line is gone and the page whole
    // (`olai-plugin-markdown/contract`'s `noteLine`, which markdown's own
    // document page places).
    yield* (yield* rendererSlots).contribute(noteLine,
      props => <AgentsProvider value={state.agents}><NoteLine path={props.path} /></AgentsProvider>)
    // NEITHER OF THIS PLUGIN'S TWO WRITTEN KEYS IS DRAWN AS A PROPERTY. The
    // tie and the switch are what a chat IS and how it opens, and both are
    // already on screen as themselves — the row's own face, and the line at
    // the top of a note with its alone/beside switch. Drawn as chips as well
    // they are the same fact twice, spelled as machinery
    // (`chat-agent-session claude:sess-…`). The aside reads the activation
    // roster once per row; only opening a fold acquires a conversation.
    // Unbound rows offer a start gesture.
    yield* slots.register("outline.row.placement", SESSION_KIND, { inRows: false })
    yield* slots.register("outline.row.placement", OPENS_KIND, { inRows: false })
    yield* slots.register("outline.row.aside", props => <AgentsProvider value={state.agents}><Standing {...props} /></AgentsProvider>)
    // THE MARK A BOUND ANCESTOR'S CRUMB WEARS — outlines draws this per crumb
    // in every trail it owns, and search's place line draws it too, so the
    // pill's door is also the one that starts a journey. It goes when chat
    // goes: no face, no mark, crumbs exactly as they were.
    yield* slots.register("outline.crumb.aside", props => <AgentsProvider value={state.agents}><CrumbMark {...props} /></AgentsProvider>)
    // THE VERBS ON A ROW'S `•••`, as a READING rather than a list — the count
    // is one per installed engine plus the ask, and the roster that decides it
    // arrives after this fiber does (`./browser/verbs.tsx` argues both).
    yield* slots.register("outline.row.action", node => rowVerbs(node, state.agents, id => agentAboveOf(id, state.agents), (row) => {
      const nav = heldNavigation()
      if (nav === undefined) return "Can't open this right now"
      focusAgent(nav, row)
    }))
    // THE STANDING TABLE, AS A DECLARED BROWSER SERVICE — one row per mounted
    // engine, live, keyed to this activation's own roster cell
    // (`./browser/engines.tsx` argues the shape). Published the way
    // `alerts.channel` is: an `own` service under this plugin's namespace, so
    // an engine plugin that draws its row in the plugins panel holds it for
    // exactly as long as chat's fiber is up — chat off means nothing is
    // probing, and the row component pends rather than guessing.
    yield* (yield* Offers).own("engines", () => state.engines)
  }),
})

/** The speaker waits for identity without taking the conversation away. */
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
  /** THE PHONE'S THUMB, DECLARED — a component of its own because it needs
   *  the shell (to open the drawer) and nothing else of this row's does. */
  thumb: definePlugin({ name: "thumb", needs: [appShell, rendererSlots], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    const renderer = yield* rendererSlots
    const roster = () => agentReadings()?.agents
    yield* renderer.contribute(thumbSeats, {
      order: 30,
      body: () => <Show when={roster()}>{agents => <AgentsProvider value={agents()}><ChatsThumb reveal={geometry.revealSidebar} /></AgentsProvider>}</Show>,
    })
  }) }),
  /** THE SHELL'S BREAKPOINT, DECLARED — a component of its own, so the chat
   *  page keeps drawing under another layout (`./browser/shell.ts`). Below
   *  `md` the panes are a strip of tabs, which is what the page's own door
   *  reads it for. */
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
  /** What this deployment is called, DECLARED — a component of its own so a
   *  notification is raised with the bare word rather than not at all when the
   *  shell is absent (`./browser/deployment.ts`). */
  deployment: definePlugin({ name: "deployment", needs: [appDeployment], apply: Effect.gen(function*() {
    const named = yield* appDeployment
    yield* Effect.acquireRelease(Effect.sync(() => holdDeployment(named)), stop => Effect.sync(stop))
  }) }),
  /** THE ROUTER'S DOORS INTO THIS ROW, and the one this row offers back over
   *  it: `chat.beside` (`./beside.ts`), which puts a conversation in the pane
   *  beside the page a press came from. Offered HERE because it is a router
   *  call, so a consumer that declares it waits for exactly what the gesture
   *  waits for. */
  navigation: definePlugin({ name: "navigation", needs: [navigationService, paletteControl, Offers], apply: Effect.gen(function*() {
    const control = yield* paletteControl
    yield* Effect.acquireRelease(Effect.sync(() => holdPalette(control)), stop => Effect.sync(stop))
    const router = yield* navigationService
    yield* Effect.acquireRelease(Effect.sync(() => holdNavigation(router)), stop => Effect.sync(stop))
    yield* (yield* Offers).own(BESIDE, () => ({
      open: ({ item, from }) => {
        // THE DRAWN-ONCE RULE, as every face in this row reads it
        // (`./browser/agents/beside.ts`): a pane that already has this
        // conversation is focused rather than a second one opened — including
        // the pane the press came from, which is already there.
        const at = drawnIn(router.panes().map((pane) => pane.route()), itemKey(item))
        if (at !== null) router.focus(at)
        else router.openRight(from, chatRouteOf(item))
      },
    } satisfies BesideDoor))
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
  /** WHETHER THIS TAB IS REPLACING ITS WIRE, DECLARED — a component of its
   *  own so every other face of this row keeps drawing on a serve with no
   *  management door, and so a level that has to know asks through a service
   *  rather than reaching into `@olai/web` (`./browser/plugin-roster.ts`). */
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
  /** The plugins panel's opener, DECLARED — a component of its own so the
   *  engine pickers keep working with no inspector mounted; they then offer no
   *  door (`./browser/plugins-door.ts`). */
  plugins: definePlugin({ name: "plugins", needs: [configurationPanel], apply: Effect.gen(function*() {
    const panel = yield* configurationPanel
    yield* Effect.acquireRelease(Effect.sync(() => holdPluginsDoor(panel)), stop => Effect.sync(stop))
  }) }),
  speaker,
}
