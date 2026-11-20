import { type AgentItem, itemKey } from "@olai/format"
import type { Route } from "olai-plugin-navigation/routes"

import { chatPage } from "./route.ts"

export const drawnIn = (routes: ReadonlyArray<Route>, key: string): number | null => {
  const at = routes.findIndex((route) => {
    const item = chatPage.value(route)
    return item !== null && itemKey(item) === key
  })
  return at < 0 ? null : at
}

export const besideIn = (routes: ReadonlyArray<Route>, key: string, here: number): number | null => {
  const at = drawnIn(routes, key)
  return at === null || at === here ? null : at
}

export const shownIn = (routes: ReadonlyArray<Route>, item: AgentItem): number | null => {
  const at = routes.findIndex((route) => {
    if (route.kind !== "at" || route.address === null) return false
    const address = route.address
    if (item.kind === "node") return address.kind === "node" && address.id === item.id
    return (address.kind === "document" || address.kind === "heading") && address.path === item.path
  })
  return at < 0 ? null : at
}

