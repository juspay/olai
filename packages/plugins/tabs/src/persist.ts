import { legacyZoomHref } from "olai-plugin-navigation/workspace"
import { parsedJson } from "@olai/web/client/preference.ts"

import type { Tab } from "./contract.ts"
import type { TabList } from "./list.ts"

export const TABS_KEY = "olai.tabs"

const STORED_VERSION = 2

interface Stored {
  readonly v: typeof STORED_VERSION
  readonly front: string
  readonly tabs: ReadonlyArray<Tab | Pick<Tab, "id" | "key">>
}

const text = (value: unknown): value is string => typeof value === "string"

const tabIn = (raw: unknown, front: unknown): Tab | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const { id, href, title, key } = raw as Record<string, unknown>
  if (!text(id) || id === "") return undefined
  const kept = text(key) ? { key } : {}
  if (text(href) && href.startsWith("/")) return { id, href, title: text(title) ? title : href, ...kept }
  return id === front && href === undefined ? { id, href: "", title: "", ...kept } : undefined
}

export const readStored = (raw: string | null, here: Pick<Tab, "href" | "title">): TabList | undefined => {
  const parsed = parsedJson(raw)
  if (typeof parsed !== "object" || parsed === null) return undefined
  const { v, front, tabs } = parsed as Record<string, unknown>
  if ((v !== 1 && v !== STORED_VERSION) || !Array.isArray(tabs)) return undefined
  const seen = new Set<string>()
  const kept: Array<Tab> = []
  for (const one of tabs) {
    const tab = tabIn(one, front)
    if (tab === undefined || seen.has(tab.id)) continue
    seen.add(tab.id)
    kept.push(v === 1 ? { ...tab, href: legacyZoomHref(tab.href) } : tab)
  }
  if (kept.length === 0) return undefined
  const shown = text(front) && seen.has(front) ? front : kept[0]!.id
  return { tabs: kept.map((tab) => (tab.id === shown ? { ...tab, href: here.href, title: here.title } : tab)), front: shown }
}

export const printStored = (list: TabList): string => {
  const stored: Stored = {
    v: STORED_VERSION,
    front: list.front,
    tabs: list.tabs.map((tab) => tab.id !== list.front ? tab : { id: tab.id, ...(tab.key === undefined ? {} : { key: tab.key }) }),
  }
  return JSON.stringify(stored)
}
