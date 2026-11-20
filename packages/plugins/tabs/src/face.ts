import { keyArray } from "@solid-primitives/keyed"
import { createMemo, type Accessor } from "solid-js"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, type WorkspaceRouting, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Tab } from "./contract.ts"

export const glyphOf = (routes: Routing, href: string): string => {
  const panes = panesOf(workspaceOf(routes, href))
  if (panes.length > 1) return "◫"
  const route = panes[0]!.route
  if (route.kind === "plugin") return route.source.kind === "node" ? "◷" : "◇"
  if (route.kind === "trash") return "⌫"
  const address = route.address
  if (address === null) return "⌂"
  return address.kind === "node" ? "•" : "¶"
}

export interface TabFace {
  readonly title: string
  readonly tip: string
}

const readable = (href: string): string => {
  try {
    return decodeURI(href)
  } catch {
    return href
  }
}

export const facesOf = (routes: WorkspaceRouting, tabs: ReadonlyArray<Tab>): ReadonlyMap<string, TabFace> => {
  const read = tabs.map(tab => readFace(routes, tab))
  return combineFaces(read)
}

const readFace = (routes: WorkspaceRouting, tab: Tab) => {
    const panes = panesOf(workspaceOf(routes, tab.href))
    const [lone, ...more] = panes
    if (lone !== undefined && more.length === 0) {
      const name = routes.name(lone.route)
      return name === undefined
        ? { tab, short: tab.title, long: tab.title }
        : { tab, short: name, long: routes.label(lone.route) }
    }
    return {
      tab,
      short: panes.map((pane) => routes.name(pane.route) ?? routes.label(pane.route)).join(" + "),
      long: panes.map((pane) => routes.label(pane.route)).join(" + "),
    }
  }

const combineFaces = (read: ReadonlyArray<ReturnType<typeof readFace>>): ReadonlyMap<string, TabFace> => {
  const longsBy = new Map<string, Set<string>>()
  for (const one of read) longsBy.set(one.short, (longsBy.get(one.short) ?? new Set<string>()).add(one.long))
  return new Map(read.map(({ tab, short, long }) => [tab.id, {
    title: (longsBy.get(short)?.size ?? 0) > 1 ? long : short,
    tip: readable(tab.href),
  }]))
}

export const createFaces = (routes: WorkspaceRouting, tabs: Accessor<ReadonlyArray<Tab>>) => {
  const rows = keyArray(tabs, tab => tab.id, tab => {
    const href = createMemo(() => tab().href)
    const title = createMemo(() => tab().title)
    return createMemo(() => readFace(routes, { id: tab().id, href: href(), title: title() }))
  })
  return createMemo(() => combineFaces(rows().map(row => row())))
}
