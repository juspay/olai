import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { registerWriter } from "@olai/edit-history/writing.ts"
import { dispatch } from "./surface.ts"
import { writeEdit } from "@olai/edit-history/writing.ts"
import { fileKind } from "@olai/format"
import type {} from "olai-plugin-layout/slots"
import { UndoSaid } from "@olai/edit-history/UndoSaid.tsx"
import {Clocks} from "@olai/plugin-api"
/** Markdown owns body subscriptions, document drafts and edit history. Its
 * provider is independent of outlines and of presentation; content and file
 * creation integrations wait only for the actual locations they consume. */
import { definePlugin, Offers, Slots } from "@olai/plugin-api"
import { Effect } from "effect"
import { createRoot, createMemo, createEffect, on } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { navigation, content, fileLinks } from "olai-plugin-navigation/contract"
import {fileAccess} from "olai-plugin-vault/contract"
import { fileTypes, fileState } from "olai-plugin-files/contract"
import { createUndo } from "@olai/edit-history/undoing.ts"
import { createDocuments, holdDocuments } from "./browser/document/documents.tsx"
import { clearDocumentDrafts } from "./browser/document/drafts.ts"
import { holdHistory, useHistory } from "./browser/history.ts"
import { holdLocations } from "./browser/locations.ts"
import { holdVault } from "./browser/vault.ts"
import { holdOpens } from "./browser/links.ts"
import { holdRouting } from "./browser/routing.ts"
import { shell as layoutShell } from "olai-plugin-layout/contract"
import { holdShell } from "./browser/shell.ts"
import { EmbeddedDocument } from "./browser/EmbeddedDocument.tsx"
import { openCreated, clearMinted } from "./browser/document/minted.ts"
import { MarkdownPageView } from "./browser/PageView.tsx"
import { documentFile } from "./browser/document-route.ts"
import { NewDocument } from "./browser/document/NewDocument.tsx"
import { documentReferences, propertyRoutes } from "olai-plugin-outlines/contract"
import { atFile } from "olai-plugin-navigation/routes"
import { DocRef } from "./browser/document/DocRef.tsx"
import { name, browserState, documentBodies, properties, type MarkdownBrowser } from "./index.ts"
import { client } from "./client.ts"
import { runAsync } from "@olai/web/client/run.ts"

export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

  const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const documents = createDocuments()
    const history = createUndo(edit => runAsync(writeEdit(edit)))
    const release = [holdDocuments(documents), holdHistory(history)]
    return {
      value: { client, documents, history, editing: { openCreated } } satisfies MarkdownBrowser,
      dispose: () => { dispose(); for (const stop of release) stop(); clearDocumentDrafts(); clearMinted() },
    }
  })), state => Effect.sync(state.dispose))
  const offers = yield* Offers
  yield* offers.own("browser-state", () => state.value)
  // WHAT A ROW THAT MINTS A DOCUMENT DOES WITH THE ANSWER — offered rather than
  // pushed into a module signal the journal read across the wall
  // (`./index.ts`'s `DocumentActions`).
  yield* offers.own("editing", () => state.value.editing)
}) })
export const components = {
  /** The shell's geometry, DECLARED — a component of its own because content
   *  runs under another layout entirely (`olai-plugin-test-layout`), so a row
   *  that waited for this one could not (`./browser/shell.ts`). */
  shell: definePlugin({ name: "shell", needs: [layoutShell], apply: Effect.gen(function*() {
    const geometry = yield* layoutShell
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
  references: definePlugin({ name: "references", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    yield* slots.contribute(documentReferences, DocRef)
    yield* slots.contribute(propertyRoutes, meaning => meaning.kind === "document" && fileKind(meaning.file) !== "outline" ? atFile(meaning.file) : undefined)
  }) }),
  content: definePlugin({ name: "content", needs: [browserState, rendererSlots, navigation, fileAccess, Clocks, fileLinks], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots
    // The walks a document's property run makes over other rows' locations,
    // from the renderer this component already names (`./browser/locations.ts`).
    yield* Effect.acquireRelease(Effect.sync(() => holdLocations(slots.read)), stop => Effect.sync(stop))
    // ...and which revision a served file is at, which is what a hypertext
    // preview watches (`./browser/vault.ts`).
    const served = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdVault(served)), stop => Effect.sync(stop))
    // ...and where a path inside a saved page opens (`./browser/links.ts`).
    const opens = yield* fileLinks
    yield* Effect.acquireRelease(Effect.sync(() => holdOpens(opens)), stop => Effect.sync(stop))
    // ...and the app's URL grammar, for the routes a property run prints
    // (`./browser/routing.ts`).
    const router = yield* navigation
    yield* Effect.acquireRelease(Effect.sync(() => holdRouting(router.routes)), stop => Effect.sync(stop))
    yield* slots.contribute(content, { matches: route => documentFile(route) !== undefined, Page: MarkdownPageView }, {children:[documentBodies, properties]})
    yield* slots.contribute(documentBodies, EmbeddedDocument)
  }) }),
  files: definePlugin({ name: "files", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileTypes, { Create: NewDocument })
  }) }),
}

export { surface } from "./surface.ts"
