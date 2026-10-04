/**
 * What a tab WEARS: a glyph for the kind of page it holds, the name it goes by,
 * and the address it holds as its tooltip. All of it is read off the address,
 * so a restored tab that has not been visited can draw its face before its
 * page is mounted. Live background lanes also update their reported titles.
 */
import { keyArray } from "@solid-primitives/keyed"
import { createMemo, type Accessor } from "solid-js"
import type { Routing } from "olai-plugin-navigation/routes"
import { panesOf, type WorkspaceRouting, workspaceOf } from "olai-plugin-navigation/workspace"

import type { Tab } from "./contract.ts"

export const glyphOf = (routes: Routing, href: string): string => {
  const panes = panesOf(workspaceOf(routes, href))
  if (panes.length > 1) return "◫"
  const route = panes[0]!.route
  if (route.kind === "plugin") return "◷"
  if (route.kind === "layout") return "◫"
  if (route.kind === "trash") return "⌫"
  const address = route.address
  if (address === null) return "⌂"
  return address.kind === "node" ? "•" : "¶"
}

export interface TabFace {
  /** What the tab says: a document by the name the files sidebar gives it
   *  (`garden`, not `garden.olai`), anything else by its page's title. */
  readonly title: string
  /** Where the tab is — its address, spelled for a person to read. */
  readonly tip: string
}

const readable = (href: string): string => {
  try {
    return decodeURI(href)
  } catch {
    return href
  }
}

/**
 * EVERY TAB'S FACE AT ONCE, because one tab's name depends on its neighbours':
 * a name is short (the stem navigation answers, `Routing.name`) until two
 * tabs holding different pages would say the same word — `notes.md` beside
 * `notes.olai`, `a/x.olai` beside `b/x.olai` — and then those tabs, and only
 * those, say their whole path instead. Two tabs on the SAME page (a duplicate)
 * say the same word, which is the truth about them.
 *
 * A page that is not a whole document (a node, an agenda, the front page)
 * wears the title its page last reported, exactly as before.
 */
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

/** Each tab owns its parse; replacing a sibling or changing the front tab
 * does not reinterpret this address. Collision labels remain a set reading. */
export const createFaces = (routes: WorkspaceRouting, tabs: Accessor<ReadonlyArray<Tab>>) => {
  const rows = keyArray(tabs, tab => tab.id, tab => {
    const href = createMemo(() => tab().href)
    const title = createMemo(() => tab().title)
    return createMemo(() => readFace(routes, { id: tab().id, href: href(), title: title() }))
  })
  return createMemo(() => combineFaces(rows().map(row => row())))
}
