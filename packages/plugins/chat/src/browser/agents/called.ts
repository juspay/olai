import { type AgentItem, nodeChatTitle, noteTitle, type Claims } from "@olai/format"
import { type Accessor, createEffect, createSignal, onCleanup } from "solid-js"
import { heldService } from "@olai/ui-primitives/held.ts"

import { agentReadings } from "./reading.ts"

export const nameOfNote = (claims: Claims | undefined, path: string): string =>
  claims === undefined ? path.slice(path.lastIndexOf("/") + 1) : noteTitle(claims, path)

export const nameOfItem = (
  item: AgentItem,
  claims: Claims | undefined,
  titled: (id: string) => string | null,
): string => item.kind === "node"
  ? nodeChatTitle(titled(item.id) ?? item.id)
  : nameOfNote(claims, item.path)

export const labelOfChat = (
  item: AgentItem,
  claims: Claims | undefined,
  titled: (id: string) => string | null,
): string => `${nameOfItem(item, claims, titled)} · chat`

export const titleOfNode = (id: string): string | null =>
  agentReadings()?.agents.at(id)?.title ?? titles.read()?.at(id) ?? null

export const createDrawnTitles = () => {
  const [drawn, setDrawn] = createSignal<ReadonlyMap<string, string>>(new Map())
  const pages = new Map<object, readonly [string, string]>()
  const republish = (): void => {
    const next = new Map<string, string>()
    for (const [id, title] of pages.values()) next.set(id, title)
    setDrawn(next)
  }
  return {
    at: (id: string): string | null => drawn().get(id) ?? null,
    says: (token: object, said: readonly [string, string] | null): void => {
      if (said === null) pages.delete(token)
      else pages.set(token, said)
      republish()
    },
  }
}
const titles = heldService<ReturnType<typeof createDrawnTitles>>()
export const holdDrawnTitles = titles.hold

export const namesNode = (id: Accessor<string | null>, title: Accessor<string | null>): void => {
  const token = {}
  createEffect(() => {
    const node = id()
    const said = node === null ? null : title()
    titles.read()?.says(token, node === null || said === null ? null : [node, said])
  })
  onCleanup(() => titles.read()?.says(token, null))
}
