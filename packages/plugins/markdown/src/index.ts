import { serviceTag } from "@olai/plugin-api/contracts"
export { name } from "./name.ts"

import type { Undo } from "@olai/edit-history/undoing.ts"
import type { Client } from "./client.ts"
import type { Documents } from "./browser/document/documents.tsx"
export interface MarkdownBrowser {
  readonly client: () => Client
  readonly documents: Documents
  readonly history: Undo
  readonly editing: DocumentActions
}
export const browserState = serviceTag<MarkdownBrowser>("markdown.browser-state")
import { location } from "@olai/plugin-api/contracts"
import type { JSX } from "solid-js"
import type { Router } from "olai-plugin-navigation/contract"
export const documentBodies = location<(props: {readonly file: string}) => JSX.Element>("markdown.body", "one")
export interface DocumentActions { readonly openCreated: (file: string, router: Router) => void }
export const documentEditing = serviceTag<DocumentActions>("markdown.editing")
import type { ReferrerMemory } from "@olai/ui-primitives/referrer-memory.ts"
export const referrerMemory = serviceTag<ReferrerMemory>("markdown.referrer-memory")
import type { Custom, PageReading } from "@olai/format"
import type { Accessor } from "solid-js"
export interface PropertiesProps { readonly custom: Custom; readonly from: string; readonly reading: Accessor<PageReading | undefined> }
export const properties = location<(props: PropertiesProps) => JSX.Element>("markdown.properties", "one")

export interface NoteLineProps {
  readonly path: string
}
export const noteLine = location<(props: NoteLineProps) => JSX.Element>("markdown.note-line", "one")
