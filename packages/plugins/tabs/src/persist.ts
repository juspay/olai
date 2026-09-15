/**
 * THE STORED SET, read and printed — a codec that tolerates anything.
 *
 * Storage is somebody else's: it may be missing, disabled, written by an older
 * build, or edited by hand. Every reading that is not a well-formed record of
 * this version answers `undefined`, and the store then starts from the one tab
 * the address bar shows. A record that is mostly right is repaired rather than
 * refused where the repair is unambiguous: a second tab with an id already
 * seen is dropped, and a front that names no tab falls to the first.
 *
 * THE FRONT TAB IS KEPT WITHOUT ITS ADDRESS AND NAME. The address bar supplies
 * both when the set is read back (`./store.ts`), so keeping them would only
 * cost a write on every change to the page in front. Read back, the front
 * record carries an empty address and name until then.
 */
import { parsedJson } from "@olai/web/client/preference.ts"

import { STORED_VERSION, type Stored, type Tab } from "./contract.ts"
import type { TabList } from "./list.ts"

const text = (value: unknown): value is string => typeof value === "string"

const tabIn = (raw: unknown, front: unknown): Tab | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const { id, href, title, key } = raw as Record<string, unknown>
  if (!text(id) || id === "") return undefined
  const kept = text(key) ? { key } : {}
  if (text(href) && href.startsWith("/")) return { id, href, title: text(title) ? title : href, ...kept }
  // The front record, kept without its address: the address bar fills it in.
  return id === front && href === undefined ? { id, href: "", title: "", ...kept } : undefined
}

export const readStored = (raw: string | null): TabList | undefined => {
  const parsed = parsedJson(raw)
  if (typeof parsed !== "object" || parsed === null) return undefined
  const { v, front, tabs } = parsed as Record<string, unknown>
  if (v !== STORED_VERSION || !Array.isArray(tabs)) return undefined
  const seen = new Set<string>()
  const kept: Array<Tab> = []
  for (const one of tabs) {
    const tab = tabIn(one, front)
    if (tab === undefined || seen.has(tab.id)) continue
    seen.add(tab.id)
    kept.push(tab)
  }
  if (kept.length === 0) return undefined
  return { tabs: kept, front: text(front) && seen.has(front) ? front : kept[0]!.id }
}

export const printStored = (list: TabList): string => {
  const stored: Stored = {
    v: STORED_VERSION,
    front: list.front,
    tabs: list.tabs.map((tab) => tab.id !== list.front ? tab : { id: tab.id, ...(tab.key === undefined ? {} : { key: tab.key }) }),
  }
  return JSON.stringify(stored)
}
