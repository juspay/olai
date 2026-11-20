import { sameList } from "@olai/web/client/same.ts"
import type { SidebarPlace } from "./slots.ts"
import { createMemo, For } from "solid-js"
import { hung } from "./faces.ts"
export function PluginSections() {
  const sections = createMemo(() => hung("sidebar.section"), undefined, { equals: sameList })
  return (
    <For each={sections()}>
      {(one) => <div data-plugin={one.plugin}>{one.face.body()}</div>}
    </For>
  )
}

export function PluginEntries(props: { readonly place: SidebarPlace }) {
  const entries = createMemo(() =>
    hung("sidebar.entry").filter((one) => one.face.place === props.place), undefined, { equals: sameList }
  )
  return (
    <For each={entries()}>
      {(one) => <div data-plugin={one.plugin}>{one.face.body()}</div>}
    </For>
  )
}

export function PluginRailEntries(props: { readonly place: SidebarPlace }) {
  const entries = createMemo(() =>
    hung("sidebar.entry").filter((one) => one.face.place === props.place), undefined, { equals: sameList }
  )
  return (
    <For each={entries()}>
      {(one) => {
        const Rail = one.face.rail
        return Rail === undefined ? null : <Rail />
      }}
    </For>
  )
}

