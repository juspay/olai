/**
 * THE STORED SET, read and printed — a codec that tolerates anything.
 *
 * Storage is somebody else's: it may be missing, disabled, written by an older
 * build, or edited by hand. Every reading that is not a well-formed record of
 * this version answers `undefined`, and the store then starts from the one tab
 * the address bar shows. A record that is mostly right is repaired rather than
 * refused where the repair is unambiguous: a second tab with an id already
 * seen is dropped, and a front that names no tab falls to the first.
 */
import { parsedJson, type PreferenceCodec } from "@olai/web/client/preference.ts"

import { STORED_VERSION, type Stored, type Tab } from "./contract.ts"
import type { TabList } from "./list.ts"

const text = (value: unknown): value is string => typeof value === "string"

const tabIn = (raw: unknown): Tab | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined
  const { id, href, title, key } = raw as Record<string, unknown>
  if (!text(id) || id === "" || !text(href) || !href.startsWith("/")) return undefined
  return { id, href, title: text(title) ? title : href, ...(text(key) ? { key } : {}) }
}

export const readStored = (raw: string | null): TabList | undefined => {
  const parsed = parsedJson(raw)
  if (typeof parsed !== "object" || parsed === null) return undefined
  const { v, front, tabs } = parsed as Record<string, unknown>
  if (v !== STORED_VERSION || !Array.isArray(tabs)) return undefined
  const seen = new Set<string>()
  const kept: Array<Tab> = []
  for (const one of tabs) {
    const tab = tabIn(one)
    if (tab === undefined || seen.has(tab.id)) continue
    seen.add(tab.id)
    kept.push(tab)
  }
  if (kept.length === 0) return undefined
  return { tabs: kept, front: text(front) && seen.has(front) ? front : kept[0]!.id }
}

export const printStored = (list: TabList): string => {
  const stored: Stored = { v: STORED_VERSION, front: list.front, tabs: list.tabs }
  return JSON.stringify(stored)
}

export const storedCodec: PreferenceCodec<TabList | undefined> = {
  parse: readStored,
  print: (list) => (list === undefined ? null : printStored(list)),
}
