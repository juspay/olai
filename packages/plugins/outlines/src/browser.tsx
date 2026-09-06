import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { registerWriter } from "@olai/edit-history/writing.ts"
import { dispatch } from "./surface.ts"
import { writeEdit } from "@olai/edit-history/writing.ts"
import { slotContracts } from "./slots.ts"
import { fileKind } from "@olai/format"
import {Clocks} from "@olai/plugin-api"
/** Outlines owns editor history, selection/drag registers, page readings and
 * browser preferences. These resources live in the provider activation, before
 * and independently of any layout. Content and settings are separate consumers. */
import { definePlugin, Offers } from "@olai/plugin-api"
import { Effect } from "effect"
import { createRoot } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { navigation, content } from "olai-plugin-navigation/contract"
import {fileAccess} from "olai-plugin-vault/contract"
import { fileTypes, fileState } from "olai-plugin-files/contract"
import { NewOutline } from "./browser/outline/NewOutline.tsx"
import { sections } from "olai-plugin-preferences/contract"
import { name, browserState, datedRows, documentReferences, pageView, titles, propertyRoutes } from "./index.ts"
import { holdReferences } from "./contracts/references.ts"
import { createDeclared, declaringFailure, clearDeclared } from "./browser/declared.ts"
import { useShowNode, clearFocus } from "./browser/focus.ts"
import { createUndo, holdUndo } from "./browser/edit/undoing.ts"
import { createReadings, holdReadings } from "./browser/reading.tsx"
import { createAir, holdAir } from "./browser/drag/air.ts"
import { createFields, holdFields } from "./browser/drag/fields.ts"
import { clearRowForms } from "./browser/date/memory.tsx"
import { clearBacklinks } from "./browser/backlinks/Backlinks.tsx"
import { clearEditorMemory } from "./browser/edit/memory.ts"
import { followDensity } from "./browser/settings/density.ts"
import { followDonePrefs } from "./browser/settings/done.ts"
import { followFolds } from "./browser/fold/memory.ts"
import { createRefiling } from "./browser/fold/refiling.ts"
import { NodeTitle } from "./browser/NodeTitle.tsx"
import { atFile } from "olai-plugin-navigation/routes"
import { DatedRow } from "./browser/DatedRow.tsx"
import { OutlinePageView } from "./browser/PageView.tsx"
import { PreferenceRows } from "./browser/PreferenceRows.tsx"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { client } from "olai-plugin-outlines/client"
import { reachable } from "@olai/web/client/connection/reaching.ts"

export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

  for (const start of [followDensity, followDonePrefs, followFolds]) {
    yield* Effect.acquireRelease(Effect.sync(start), stop => Effect.sync(stop))
  }
  yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const stops = [holdReferences({declare: createDeclared, showNode: useShowNode, failure: declaringFailure}), holdUndo(createUndo(edit => runAsync(writeEdit(edit)))),
      holdReadings(createReadings()), holdFields(createFields()), holdAir(createAir())]
    createRefiling({ ask: request => runAsync(client().procedures.nodes.homes(request)),
      reachable: () => reachable(connectionReadout()) })
    return () => { dispose(); for (const stop of stops) stop(); clearEditorMemory(); clearRowForms(); clearBacklinks(); clearFocus(); clearDeclared() }
  })), stop => Effect.sync(stop))
  yield* (yield* Offers).own("browser-state", () => ({}))
}) })

import { documentProperties } from "./browser/document-properties.tsx"
import { palette, messages } from "./browser/palette/adapter.tsx"
export const components = {
  palette, messages, "document-properties": documentProperties,
  content: definePlugin({ name: "content", needs: [browserState, rendererSlots, navigation, fileAccess, Clocks], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    yield* slots.contribute(content, {
      matches: route => route.kind === "plugin" || (route.kind === "at" && (route.address === null || route.address.kind === "node" || fileKind(route.address.path) === "outline")),
      Page: () => <OutlinePageView />,
    }, { children: [...Object.values(slotContracts), datedRows, documentReferences, pageView, titles, propertyRoutes] })
    yield* slots.contribute(datedRows, DatedRow)
    yield* slots.contribute(pageView, OutlinePageView)
    yield* slots.contribute(titles, NodeTitle)
    yield* slots.contribute(propertyRoutes, meaning => meaning.kind === "document" && fileKind(meaning.file) === "outline" ? atFile(meaning.file) : undefined)
  }) }),
  files: definePlugin({ name: "files", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileTypes, { Create: NewOutline })
  }) }),
  preferences: definePlugin({ name: "preferences", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(sections, PreferenceRows)
  }) }),
}

export { surface } from "./surface.ts"
