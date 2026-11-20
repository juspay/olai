import { createContext, createMemo, createSelector, type JSX, useContext } from "solid-js"

const NO_NEEDLES: ReadonlyArray<string> = []
import type { Accessor } from "solid-js"
import type { MatchedNode } from "@olai/format"

export interface Narrowed { readonly matchOf?: (id: string) => boolean | undefined; readonly behind?: (id: string) => boolean; readonly active: Accessor<boolean>; readonly selected: Accessor<ReadonlyMap<string,MatchedNode> | null>; readonly needles: Accessor<ReadonlyArray<string>> }

const NOTHING: Narrowed = {
  active: () => false,
  selected: () => null,
  needles: () => NO_NEEDLES,
}

const NarrowedContext = createContext<Narrowed>(NOTHING)

export function NarrowedProvider(props: {
  readonly narrowed: Narrowed
  readonly children: JSX.Element
}) {
  const selected = () => props.narrowed.selected()
  const answered = createMemo(() => selected() !== null)
  const matches = createSelector(selected, (id: string, found) => found?.has(id) === true)
  const behind = createSelector(selected, (id: string, found) => found?.get(id)?.matched === "desc")
  const narrowed: Narrowed = {
    active: () => props.narrowed.active(), selected,
    needles: () => props.narrowed.needles(),
    matchOf: id => answered() ? matches(id) : undefined,
    behind,
  }
  return (
    <NarrowedContext.Provider value={narrowed}>
      {props.children}
    </NarrowedContext.Provider>
  )
}

export const useNarrowed = (): Narrowed => useContext(NarrowedContext)
