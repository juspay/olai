import { linkPreviews } from "olai-plugin-navigation/contract"
import { OutlineLinkPreview } from "./browser/LinkPreview.tsx"
import { createDoneReveals, holdDoneReveals } from "./browser/settings/done.ts"
import { createFocusState, holdFocusState } from "./browser/focus.ts"
import { createRowElements, rowElements } from "./browser/row-elements.ts"
import { Landings } from "@olai/plugin-api"
import { holdLandings } from "./browser/landings.ts"
import type {} from "olai-plugin-chat/slots"
import { fileOf, story } from "./browser/replyFace.tsx"

import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { fileKinds } from "olai-plugin-files/contract"
import { pages } from "olai-plugin-navigation/contract"
import { KindGlyph } from "./glyph.tsx"
import { TESTID as KIND_IDS } from "./testids.ts"
import { holdServed } from "./browser/vault.ts"
import { Edits, Wired, Slots, editApply } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { dispatch } from "./surface.ts"
import { holdEdits, writeEdit } from "./browser/writes.ts"
import { slotContracts } from "./slots.ts"
import { fileKind } from "@olai/format"
import {Clocks} from "@olai/plugin-api"
import { definePlugin, Faces, Offers } from "@olai/plugin-api"
import { holdFaces } from "./browser/faces.ts"
import { holdLocations } from "./browser/locations.ts"
import { holdRouting } from "./browser/routing.ts"
import { holdClocks } from "./browser/clock.ts"
import { holdGestures } from "./browser/gestures.ts"
import { readings } from "olai-plugin-search/reading"
import { holdReading } from "./browser/search.ts"
import { pinnedShelf } from "olai-plugin-pins/contract"
import { holdPins } from "./browser/pins.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { holdShell } from "./browser/shell.ts"
import { Effect } from "effect"
import { createRoot } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { navigation, content, gestures } from "olai-plugin-navigation/contract"
import {fileAccess} from "olai-plugin-vault/contract"
import { fileTypes, fileState } from "olai-plugin-files/contract"
import { holdFileControls } from "./browser/files.tsx"
import { NewOutline, outlineMaking } from "./browser/outline/NewOutline.tsx"
import { sections } from "olai-plugin-preferences/contract"
import { referrerMemory } from "olai-plugin-markdown/contract"
import { backlinksMemory } from "./browser/backlinks/memory.ts"
import { name, browserState, datedRows, pageView, titles, propertyRoutes, type OutlinesBrowser } from "./index.ts"
import type { References } from "./contracts/references.ts"
import { openOverlaySocket, overlayRoot } from "./browser/overlay.ts"
import { createDeclared, declaringFailure, createDeclarations, holdDeclarations } from "./browser/declared.ts"
import { clearNode, focusedNode, revealNode } from "./browser/focus.ts"
import { nodeHome } from "./browser/home.ts"
import { createUndo, holdUndo } from "./browser/edit/undoing.ts"
import { createReadings, holdReadings } from "./browser/reading.tsx"
import { createAir, holdAir } from "./browser/drag/air.ts"
import { createFields, holdFields } from "./browser/drag/fields.ts"

import { followDensity } from "./browser/settings/density.ts"
import { followDonePrefs } from "./browser/settings/done.ts"
import { followFolds } from "./browser/fold/memory.ts"
import { createRefiling } from "./browser/fold/refiling.ts"
import { NodeTitle } from "./browser/NodeTitle.tsx"
import { atFile } from "olai-plugin-navigation/routes"
import { DatedRow } from "./browser/DatedRow.tsx"
import { OutlinePageView } from "./browser/PageView.tsx"

import { clearEditorMemory } from "./browser/edit/memory.ts"
import { PreferenceRows } from "./browser/PreferenceRows.tsx"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { client } from "./client.ts"
import { reachable } from "@olai/web/client/connection/reaching.ts"

export default definePlugin({ name, needs: [Landings, Wired, Offers, Edits, Slots], apply: Effect.gen(function*() {
    const landingTable = yield* Landings
    yield* Effect.acquireRelease(Effect.sync(() => holdLandings(landingTable)), stop => Effect.sync(stop))
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  const edits = yield* Edits
  yield* edits.register(dispatch["edit.apply"], edit => editApply(ownWire.client() as Client, edit))
  yield* Effect.acquireRelease(Effect.sync(() => holdEdits(edits)), stop => Effect.sync(stop))

  for (const start of [followDensity, followDonePrefs, followFolds]) {
    yield* Effect.acquireRelease(Effect.sync(start), stop => Effect.sync(stop))
  }
  const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const references: References = { reveal: revealNode, home: nodeHome, focused: focusedNode, declare: createDeclared, failure: declaringFailure }
    const undo = createUndo(edit => runAsync(writeEdit(edit)))
    const readings = createReadings()
    const fields = createFields()
    const air = createAir()
    const stops = [holdDoneReveals(createDoneReveals()), holdDeclarations(createDeclarations()), holdFocusState(createFocusState()), rowElements.hold(createRowElements()), holdUndo(undo), holdReadings(readings), holdFields(fields), holdAir(air), openOverlaySocket()]
    createRefiling({ ask: request => runAsync(client().procedures.nodes.homes(request)),
      reachable: () => reachable(connectionReadout()) })
    return {
      value: { client, undo, readings, fields, air, references, overlay: overlayRoot } satisfies OutlinesBrowser,
      dispose: () => { dispose(); for (const stop of stops) stop(); clearEditorMemory(); clearNode() },
    }
  })), state => Effect.sync(state.dispose))
  const offers = yield* Offers
  yield* offers.own("browser-state", () => state.value)
  yield* offers.own("references", () => state.value.references)
  yield* (yield* Slots).register("tool.reply", { fileOf, story })
}) })

import { documentProperties } from "./browser/document-properties.tsx"
import { palette, messages } from "./browser/palette/adapter.tsx"
export const components = {
  glyph: definePlugin({ name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    const by = { holds: "nodes" } as const
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph: KindGlyph, noun: "outline", article: "an", testid: KIND_IDS.outlineLink }, { key: fileKindKey(by) })
  }) }),
  palette, messages, "document-properties": documentProperties,
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
  content: definePlugin({ name: "content", needs: [browserState, rendererSlots, navigation, fileAccess, Clocks, Faces, gestures], apply: Effect.gen(function*() {
    yield* holdFaces(yield* Faces)
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(served)), stop => Effect.sync(stop))
    const router = yield* navigation
    yield* Effect.acquireRelease(Effect.sync(() => holdRouting(router.routes)), stop => Effect.sync(stop))
    const clock = yield* Clocks
    yield* Effect.acquireRelease(Effect.sync(() => holdClocks(clock)), stop => Effect.sync(stop))
    const touch = yield* gestures
    yield* Effect.acquireRelease(Effect.sync(() => holdGestures(touch)), stop => Effect.sync(stop))
    const slots = yield* rendererSlots
    yield* Effect.acquireRelease(Effect.sync(() => holdLocations(slots.read)), stop => Effect.sync(stop))
    const Page = () => <OutlinePageView />
    yield* slots.contribute(pages, { by: { holds: "nodes" }, edits: true, page: Page }, { key: fileKindKey({ holds: "nodes" }) })
    yield* slots.contribute(content, {
      matches: route => (route.kind === "plugin" && route.source.kind === "node") || (route.kind === "at" && (route.address === null || route.address.kind === "node" || (served.kindOf(route.address.path) === null || served.claims().byKind.get(served.kindOf(route.address.path)!)?.holds === "nodes"))),
      Page,
    }, { children: [...Object.values(slotContracts), datedRows, pageView, titles, propertyRoutes] })
    yield* slots.contribute(linkPreviews, {
      priority: 0,
      matches: route => route.kind === "at" && route.address !== null &&
        (route.address.kind === "node" || route.address.kind === "row" ||
          (route.address.kind === "document" && served.claims().byKind.get(served.kindOf(route.address.path) ?? "")?.holds === "nodes")),
      Preview: OutlineLinkPreview,
    })
    yield* slots.contribute(datedRows, DatedRow)
    yield* slots.contribute(pageView, OutlinePageView)
    yield* slots.contribute(titles, NodeTitle)
    yield* slots.contribute(propertyRoutes, meaning => meaning.kind === "document" && served.claims().byKind.get(served.kindOf(meaning.file) ?? "")?.holds === "nodes" ? atFile(meaning.file) : undefined)
  }) }),
  "file-controls": definePlugin({ name: "file-controls", needs: [fileState], apply: Effect.gen(function*() {
    const controls = yield* fileState
    yield* Effect.acquireRelease(Effect.sync(() => holdFileControls(controls)), stop => Effect.sync(stop))
  }) }),
  shelf: definePlugin({ name: "shelf", needs: [pinnedShelf], apply: Effect.gen(function*() {
    const shelf = yield* pinnedShelf
    yield* Effect.acquireRelease(Effect.sync(() => holdPins(shelf)), stop => Effect.sync(stop))
  }) }),
  matcher: definePlugin({ name: "matcher", needs: [readings], apply: Effect.gen(function*() {
    const reading = yield* readings
    yield* Effect.acquireRelease(Effect.sync(() => holdReading(reading)), stop => Effect.sync(stop))
  }) }),
  files: definePlugin({ name: "files", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileTypes, { making: outlineMaking, Create: NewOutline })
  }) }),
  backlinks: definePlugin({ name: "backlinks", needs: [referrerMemory], apply: Effect.gen(function*() {
    const memory = yield* referrerMemory
    yield* Effect.acquireRelease(Effect.sync(() => backlinksMemory.hold(memory)), stop => Effect.sync(stop))
  }) }),
  preferences: definePlugin({ name: "preferences", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(sections, { heading: "outlines" as const, order: 0, scope: "browser" as const, body: PreferenceRows })
  }) }),
}

export { surface } from "./surface.ts"
