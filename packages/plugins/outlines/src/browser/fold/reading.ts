import { createComponent, createContext, createSelector, useContext, type JSX } from "solid-js"

import { useNarrowed } from "../filter/narrowed.tsx"
import { collapsedNodes } from "./memory.ts"

const NONE: ReadonlySet<string> = new Set()

export const createFoldReading = (): (() => ReadonlySet<string>) => {
  const narrowed = useNarrowed()
  return () => (narrowed.active() ? NONE : collapsedNodes())
}

const FoldContext = createContext<(id: string) => boolean>()
export function FoldProvider(props: { readonly children: JSX.Element }) {
  const matches = createSelector(createFoldReading(), (id: string, folded) => folded.has(id))
  return createComponent(FoldContext.Provider, { value: matches, get children() { return props.children } })
}
export const useFolded = () => useContext(FoldContext) ?? createSelector(createFoldReading(), (id: string, folded) => folded.has(id))
