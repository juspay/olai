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
import { EmbeddedDocument } from "./browser/EmbeddedDocument.tsx"
import { openCreated, clearMinted } from "./browser/document/minted.ts"
import { MarkdownPageView } from "./browser/PageView.tsx"
import { documentFile } from "./browser/document-route.ts"
import { NewDocument } from "./browser/document/NewDocument.tsx"
import { documentReferences, propertyRoutes } from "olai-plugin-outlines/contract"
import { atFile } from "olai-plugin-navigation/routes"
import { DocRef } from "./browser/document/DocRef.tsx"
import { name, browserState, documentBodies, properties, holdDocumentActions } from "./index.ts"
import { client } from "olai-plugin-markdown/client"
import { runAsync } from "@olai/web/client/run.ts"

export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

  yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const release = [holdDocumentActions({openCreated}), holdDocuments(createDocuments()), holdHistory(createUndo(edit => runAsync(writeEdit(edit))))]
    return () => { dispose(); for (const stop of release) stop(); clearDocumentDrafts(); clearMinted() }
  })), stop => Effect.sync(stop))
  yield* (yield* Offers).own("browser-state", () => ({}))
}) })
export const components = {
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
    yield* slots.contribute(content, { matches: route => documentFile(route) !== undefined, Page: MarkdownPageView }, {children:[documentBodies, properties]})
    yield* slots.contribute(documentBodies, EmbeddedDocument)
  }) }),
  files: definePlugin({ name: "files", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileTypes, { Create: NewDocument })
  }) }),
}

export { surface } from "./surface.ts"
