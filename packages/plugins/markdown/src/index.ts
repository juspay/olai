import { serviceTag } from "@olai/plugin-api/contracts"
export { name } from "./name.ts"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Client } from "./client.ts"
import type { Documents } from "./browser/document/documents.tsx"

/**
 * WHAT THIS ROW OWNS IN A TAB — the state a consumer that names
 * {@link browserState} is handed.
 *
 * IT WAS `Record<string, never>`: a service announcing "my browser state is
 * ready" and carrying nothing, while the document collection, the editor
 * history and this row's own client sat in module variables beside it. Cordis
 * saw the announcement and none of the consumers, which is the audit's §2 —
 * and `olai-plugin-outlines` names this key to draw a document's property run,
 * so the emptiness was crossing a package wall as well.
 *
 * THE TYPES ARE `import type` and every one is this package's own, so this door
 * names the shapes without pulling a line of the row's implementation onto
 * anybody's graph.
 */
export interface MarkdownBrowser {
  /** This row's sibling client, on whichever wire is current. */
  readonly client: () => Client
  /** The open documents this tab holds, and their drafts. */
  readonly documents: Documents
  /** The editor history a document's keystrokes go on — this row's own, and
   *  deliberately not the outline's. */
  readonly history: Undo
  /** ...and what this row does with a document another row minted, which is
   *  also offered on its own key for the one consumer in another package
   *  ({@link documentEditing}). */
  readonly editing: DocumentActions
}
export const browserState = serviceTag<MarkdownBrowser>("markdown.browser-state")
import { location } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
import type { Router } from "olai-plugin-navigation/contract"
export const documentBodies = location<(props: {readonly file: string}) => JSX.Element>("markdown.body", "one")
/**
 * WHAT A ROW THAT MINTS A DOCUMENT DOES WITH THE ANSWER — open it, in the
 * router the caller is looking at.
 *
 * The journal's day page mints a note and has to hand the file somewhere; where
 * a new document is opened, and what an open editor does with it, is this row's
 * business and not the journal's.
 *
 * ## The signal beside this tag is gone, and that is the phase
 *
 * There was a `createSignal` here holding the live value, a `useDocumentActions`
 * reading it and a `holdDocumentActions` this row's activation called — so the
 * value crossed to `olai-plugin-journal` as a module variable while the SERVICE
 * next to it carried nothing. Cordis saw no consumer, nothing was reported
 * `waiting`, and the day page's own guard (`useDocumentActions() === actions`,
 * re-read after the round trip) was the only thing standing between a departed
 * row and a write into it (the audit's §2 and §12).
 *
 * The journal declares this key on a component of its own now and holds it
 * there. The guard survives — a round trip can outlive an activation whatever
 * carries the value — and what changed is that the dependency is declared, the
 * withdrawal is the runtime's, and the button is drawn or not drawn by the
 * journal's own reading of a service it named.
 */
export interface DocumentActions { readonly openCreated: (file: string, router: Router) => void }
export const documentEditing = serviceTag<DocumentActions>("markdown.editing")
import type { Custom, PageReading } from "@olai/format"
import type { Accessor } from "solid-js"
export interface PropertiesProps { readonly custom: Custom; readonly from: string; readonly reading: Accessor<PageReading | undefined> }
export const properties = location<(props: PropertiesProps) => JSX.Element>("markdown.properties", "one")
