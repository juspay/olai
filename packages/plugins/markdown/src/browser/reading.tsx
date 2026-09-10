/** Document-page metadata context. No outline editor or outline reading owns it. */
import { createContext, useContext, type Accessor, type JSX } from "solid-js"
import type { PageReading } from "@olai/format"
const Context = createContext<Accessor<PageReading | undefined>>()
export function DocumentReading(props: { readonly value: Accessor<PageReading | undefined>; readonly children: JSX.Element }) {
  return <Context.Provider value={props.value}>{props.children}</Context.Provider>
}
export const useDocumentReading = () => useContext(Context) ?? (() => undefined)
