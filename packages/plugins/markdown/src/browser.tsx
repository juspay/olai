import { fileKind } from "@olai/format"
import {Clocks} from "@olai/plugin-api"
/** Markdown owns body subscriptions, document drafts and edit history. Its
 * provider is independent of outlines and of presentation; content and file
 * creation integrations wait only for the actual locations they consume. */
import { definePlugin, Offers } from "@olai/plugin-api"
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
import { olai } from "@olai/web/client/wire.ts"
import { runAsync } from "@olai/web/client/run.ts"

export default definePlugin({ name, needs: [Offers], apply: Effect.gen(function*() {
  yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const release = [holdDocumentActions({openCreated}), holdDocuments(createDocuments()), holdHistory(createUndo(edit => runAsync(olai.procedures.edit.apply(edit))))]
    return () => { dispose(); for (const stop of release) stop(); clearDocumentDrafts(); clearMinted() }
  })), stop => Effect.sync(stop))
  yield* (yield* Offers).own("browser-state", () => ({}))
}) })
export const components = {
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
