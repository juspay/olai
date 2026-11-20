import type { Accessor } from "solid-js"

import { createPreference,parsedJson } from "@olai/web/client/preference.ts"

export const FOLDERS_KEY = "olai.sidebar.folders"

export const parseFolders = (raw: string | null): ReadonlySet<string> => {
  const decoded = parsedJson(raw)
  if (!Array.isArray(decoded)) return new Set()
  return new Set(decoded.filter((path): path is string => typeof path === "string"))
}

export const printFolders = (open: ReadonlySet<string>): string | null =>
  open.size === 0 ? null : JSON.stringify([...open].sort())

export const prunedFolders = (
  open: ReadonlySet<string>,
  live: ReadonlySet<string>,
): ReadonlySet<string> =>
  live.size === 0 ? open : new Set([...open].filter((path) => live.has(path)))

const pref = createPreference(FOLDERS_KEY, {
  parse: parseFolders,
  print: printFolders,
})

export const openFolders: Accessor<ReadonlySet<string>> = pref.value

export const toggleFolder = (path: string, live: ReadonlySet<string>): void => {
  const next = new Set(pref.value())
  if (!next.delete(path)) next.add(path)
  pref.set(prunedFolders(next, live))
}

export const followFolders = pref.follow
