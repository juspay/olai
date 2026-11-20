import { linkPreviews } from "olai-plugin-navigation/contract"
import { MarkdownLinkPreview } from "./browser/LinkPreview.tsx"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { fileKinds } from "olai-plugin-files/contract"
import { pages } from "olai-plugin-navigation/contract"
import { KindGlyph } from "./glyph.tsx"
import { TESTID as KIND_IDS } from "./testids.ts"
import { Edits, Wired, editApply } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { dispatch } from "./surface.ts"
import { holdEdits, writeEdit } from "./browser/writes.ts"
import type {} from "olai-plugin-layout/slots"
import { UndoSaid } from "@olai/edit-history/UndoSaid.tsx"
import {Clocks} from "@olai/plugin-api"
import { definePlugin, Offers, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import { createRoot, createMemo, createEffect, on, onCleanup } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { navigation, content } from "olai-plugin-navigation/contract"
import {fileAccess} from "olai-plugin-vault/contract"
import { fileTypes, fileState } from "olai-plugin-files/contract"
import { holdFileControls } from "./browser/files.tsx"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { createDocuments, holdDocuments } from "./browser/document/documents.tsx"
import { holdHistory, useHistory } from "./browser/history.ts"
import { holdLocations } from "./browser/locations.ts"
import { holdServed } from "./browser/vault.ts"
import { holdClocks } from "./browser/clock.ts"
import { holdRouting } from "./browser/routing.ts"
import { shell as appShell } from "olai-plugin-layout/contract"
import { holdShell } from "./browser/shell.ts"
import { EmbeddedDocument } from "./browser/EmbeddedDocument.tsx"
import { createReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"
import { referrersMemory } from "./browser/memory.ts"
import { openCreated } from "./browser/document/minted.ts"
import { documentFile } from "./browser/document-route.ts"
import { MarkdownPageView } from "./browser/PageView.tsx"
import { atFile } from "olai-plugin-navigation/routes"
import { name, browserState, documentBodies, noteLine, properties, type MarkdownBrowser } from "./index.ts"

import { runAsync } from "@olai/web/client/run.ts"
import { documentMaking, NewDocument } from "./browser/document/NewDocument.tsx"
import { propertyRoutes } from "olai-plugin-outlines/contract"

export default definePlugin({ name, needs: [Wired, Offers, Edits], apply: Effect.gen(function*() {
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  const edits = yield* Edits
  yield* edits.register(dispatch["edit.apply"], edit => editApply(ownWire.client() as Client, edit))
  yield* Effect.acquireRelease(Effect.sync(() => holdEdits(edits)), stop => Effect.sync(stop))

  const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const documents = createDocuments()
    const history = createUndo(edit => runAsync(writeEdit(edit)))
    const release = [holdDocuments(documents), holdHistory(history)]
    return {
      value: { documents, history, editing: { openCreated } } satisfies MarkdownBrowser,
      dispose: () => { dispose(); for (const stop of release) stop() },
    }
  })), state => Effect.sync(state.dispose))
  const memory = createReferrerMemory()
  yield* Effect.acquireRelease(Effect.sync(() => referrersMemory.hold(memory)), stop => Effect.sync(stop))
  const offers = yield* Offers
  yield* offers.own("browser-state", () => state.value)
  yield* offers.own("editing", () => state.value.editing)
  yield* offers.own("referrer-memory", () => memory)
}) })
export const components = {
  drafts: definePlugin({ name: "drafts", needs: [browserState, navigation], apply: Effect.gen(function*() {
    const { documents } = yield* browserState
    const nav = yield* navigation
    yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      createEffect(() => documents.retainEditors(new Map(nav.lanes().flatMap(lane => lane.panes().map(pane => {
        const route = pane.route()
        return [pane.id, route.kind === "at" && route.address !== null && route.address.kind !== "node" ? route.address.path : undefined] as const
      })))))
      createEffect(() => {
        const panes = new Set(nav.lanes().flatMap(lane => lane.panes().map(pane => pane.id)))
        const memory = referrersMemory.read()
        for (const key of memory?.opened?.keys() ?? []) {
          const [pane] = JSON.parse(key) as [string, string]
          if (!panes.has(pane)) memory?.forget(key)
        }
      })
      onCleanup(() => documents.retainEditors(new Map()))
      return dispose
    })), dispose => Effect.sync(dispose))
  }) }),
  glyph: definePlugin({ name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    const by = { kind: "markdown" } as const
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph: KindGlyph, noun: "document", article: "a", testid: KIND_IDS.documentLink }, { key: fileKindKey(by) })
  }) }),
  "file-controls": definePlugin({ name: "file-controls", needs: [fileState], apply: Effect.gen(function*() {
    const controls = yield* fileState
    yield* Effect.acquireRelease(Effect.sync(() => holdFileControls(controls)), stop => Effect.sync(stop))
  }) }),
  shell: definePlugin({ name: "shell", needs: [appShell], apply: Effect.gen(function*() {
    const geometry = yield* appShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
  messages: definePlugin({name:"messages",needs:[browserState,navigation,Slots],apply:Effect.gen(function*(){
    const nav = yield* navigation
    const history = useHistory()
    yield* (yield* Slots).register("app.banner", () => <UndoSaid said={nav.focused()?.history === history ? history.said() : null} />)
  })}),
  history: definePlugin({name:"history", needs:[browserState,navigation], apply: Effect.gen(function*() {
    const nav = yield* navigation
    const history = useHistory()
    yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
      const file = createMemo(() => nav.focused()?.file)
      createEffect(on(file, () => history.clear(), {defer:true}))
      return dispose
    })), dispose => Effect.sync(dispose))
  })}),
  references: definePlugin({ name: "references", needs: [browserState, rendererSlots, fileAccess], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    const served = yield* fileAccess
    yield* slots.contribute(propertyRoutes, meaning => meaning.kind === "document" && served.kindOf(meaning.file) !== null && served.claims().byKind.get(served.kindOf(meaning.file)!)?.holds !== "nodes" ? atFile(meaning.file) : undefined)
  }) }),
  content: definePlugin({ name: "content", needs: [browserState, rendererSlots, navigation, fileAccess, Clocks], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    const clocks = yield* Clocks
    yield* Effect.acquireRelease(Effect.sync(() => holdClocks(clocks)), stop => Effect.sync(stop))
    yield* Effect.acquireRelease(Effect.sync(() => holdLocations(slots.read)), stop => Effect.sync(stop))
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(served)), stop => Effect.sync(stop))
    const router = yield* navigation
    yield* Effect.acquireRelease(Effect.sync(() => holdRouting(router.routes)), stop => Effect.sync(stop))
    yield* slots.contribute(pages, { by: { kind: "markdown" }, edits: true, page: () => <MarkdownPageView /> }, {key:fileKindKey({kind:"markdown"}),children:[documentBodies, properties, noteLine]})
    yield* slots.contribute(linkPreviews, {
      priority: 0,
      matches: route => route.kind === "at" && route.address !== null && route.address.kind !== "node" && served.kindOf(route.address.path) === "markdown",
      Preview: MarkdownLinkPreview,
    })
    yield* slots.contribute(documentBodies, EmbeddedDocument)
  }) }),
  files: definePlugin({ name: "files", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileTypes, { making: documentMaking, Create: NewDocument })
  }) }),
}

export { surface } from "./surface.ts"
