import { type AgentItem, type Claims, isNotePath, itemKey } from "@olai/format"
import { atFile, fileNamed, type Route, zoomNode } from "olai-plugin-navigation/routes"
import { chatPage } from "./route.ts"

export const itemHere = (claims: Claims | undefined, route: Route): AgentItem | null => {
  if (route.kind !== "at" || route.address === null) return null
  const address = route.address
  if (address.kind === "row") return null
  if (address.kind === "node") return { kind: "node", id: address.id }
  if (claims === undefined) return null
  return isNotePath(claims, address.path) ? { kind: "note", path: address.path } : null
}

export const noteHere = (claims: Claims | undefined, route: Route): string | null => {
  const item = itemHere(claims, route)
  return item === null || item.kind !== "note" ? null : item.path
}

export const routeOfItem = (item: AgentItem): Route =>
  item.kind === "note" ? atFile(item.path) : zoomNode(item.id)

export const isCurrent = (
  claims: Claims | undefined,
  route: Route,
  row: { readonly id: string; readonly file: string; readonly kind: "node" | "note" },
  unfolded: boolean,
): boolean => {
  const chat = chatPage.value(route)
  if (chat !== null) return itemKey(chat) === row.id
  const here = itemHere(claims, route)
  if (here !== null && itemKey(here) === row.id) return true
  return row.kind === "node" && unfolded && fileNamed(route) === row.file
}
