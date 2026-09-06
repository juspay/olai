import { serviceTag } from "@olai/plugin-api/contracts"
export { name } from "./name.ts"
export const browserState = serviceTag<Record<string, never>>("markdown.browser-state")
import { location } from "@olai/plugin-api/contracts"
import { createSignal, type JSX } from "solid-js"
import type { Router } from "olai-plugin-navigation/contract"
export const documentBodies = location<(props: {readonly file: string}) => JSX.Element>("markdown.body", "one")
export interface DocumentActions { readonly openCreated: (file: string, router: Router) => void }
export const documentEditing = serviceTag<DocumentActions>("markdown.editing")
const [actions, setActions] = createSignal<DocumentActions | undefined>()
export const useDocumentActions = actions
export const holdDocumentActions = (value: DocumentActions): (() => void) => {
  setActions(value)
  return () => { if (actions() === value) setActions(undefined) }
}
import type { Custom, PageReading } from "@olai/format"
import type { Accessor } from "solid-js"
export interface PropertiesProps { readonly custom: Custom; readonly from: string; readonly reading: Accessor<PageReading | undefined> }
export const properties = location<(props: PropertiesProps) => JSX.Element>("markdown.properties", "one")
