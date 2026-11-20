import { type AgentItem, type Claims, ID_SHAPE, isNotePath, readPath, spellPath } from "@olai/format"
import { defineSelfDrawnRoute } from "olai-plugin-navigation/routes"

import { servedDirectory } from "../vault.ts"
import { labelOfChat, titleOfNode } from "./called.ts"

export const CHAT_PATH = "/chat/"

export const itemAt = (claims: Claims | undefined, pathname: string): AgentItem | null => {
  if (!pathname.startsWith(CHAT_PATH)) return null
  const rest = pathname.slice(CHAT_PATH.length)
  if (rest === "") return null
  if (ID_SHAPE.test(rest)) return { kind: "node", id: rest }
  const path = readPath(rest)
  if (path === null || path === "" || path.startsWith("/") || path.endsWith("/")) return null
  if (path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) return null
  if (claims === undefined) return { kind: "note", path }
  return isNotePath(claims, path) ? { kind: "note", path } : null
}

export const chatSpelling = (item: AgentItem): string =>
  item.kind === "node" ? item.id : spellPath(item.path)

export const chatPage = defineSelfDrawnRoute<AgentItem>({
  claims: [{ kind: "prefix", path: CHAT_PATH }],
  parse: (pathname) => itemAt(servedDirectory()?.claims(), pathname),
  href: (item) => `${CHAT_PATH}${chatSpelling(item)}`,
  breadcrumb: (item) => labelOfChat(item, servedDirectory()?.claims(), titleOfNode),
  narrowable: false,
})

export const chatRouteOf = (item: AgentItem) => chatPage.to(item)
