import { sameList } from "@olai/web/client/same.ts"
import type {} from "./slots.ts"
import { createMemo, For } from "solid-js"

import { hung } from "./faces.ts"

export function PluginHeaders(props: { readonly place: "lead" | "cluster" }) {
  const headers = createMemo(() => hung("app.header").filter((one) => one.face.place === props.place), undefined, { equals: sameList })
  return (
    <For each={headers()}>
      {(one) => <one.face.body />}
    </For>
  )
}

export function PluginBanners() {
  const banners = createMemo(() => hung("app.banner"), undefined, { equals: sameList })
  return <For each={banners()}>{(one) => <one.face />}</For>
}
