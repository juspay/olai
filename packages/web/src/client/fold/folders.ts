/**
 * Which folders of the directory this browser is keeping OPEN.
 *
 * The same memory as the outline tree's (./memory.ts) and the same doctrine —
 * a preference of this browser, never a byte on disk — with the set INVERTED,
 * because the two trees have opposite defaults: nodes start open, so what is
 * remembered is what is shut; folders start collapsed (#105 — a deep corpus is
 * not a wall of paths), so what is remembered is what is open.
 *
 * A directory path is the natural id here, and the reason it can be one is that
 * the sidebar's tree is BUILT from paths (`../fileTree.ts`): a folder exists
 * exactly while some file is under it. So the same pruning rule applies, with
 * the same argument — a path no file lives under any more is a folder that is
 * gone, and dropping it on the next write keeps the entry the size of the
 * directory rather than the size of its history.
 *
 * Its own key rather than a corner of the folds entry: they are two trees, and
 * a reader who has opened three folders has said nothing about any node.
 */

import { type Accessor, createSignal } from "solid-js"

import {
  parsedJson,
  readPreference,
  watchPreference,
  writePreference,
} from "../preference.ts"

export const FOLDERS_KEY = "olai.sidebar.folders"

/** The paths in storage, or none — which is what a browser that has never been
 *  asked and a value this app did not write both come to (./memory.ts says why
 *  that is a default rather than an error). */
export const parseFolders = (raw: string | null): ReadonlySet<string> => {
  const decoded = parsedJson(raw)
  if (!Array.isArray(decoded)) return new Set()
  return new Set(decoded.filter((path): path is string => typeof path === "string"))
}

/** ...and back, or `null` for "remember nothing" — a key removed rather than an
 *  empty list left behind. Sorted, for the reason `printFolds` is. */
export const printFolders = (open: ReadonlySet<string>): string | null =>
  open.size === 0 ? null : JSON.stringify([...open].sort())

/** The same memory with folders that are no longer in the directory dropped.
 *  `live` is every directory path the tree currently draws; an empty one is a
 *  directory that has not loaded, which prunes nothing. */
export const prunedFolders = (
  open: ReadonlySet<string>,
  live: ReadonlySet<string>,
): ReadonlySet<string> =>
  live.size === 0 ? open : new Set([...open].filter((path) => live.has(path)))

const [folders, setFolders] = createSignal<ReadonlySet<string>>(
  parseFolders(readPreference(FOLDERS_KEY)),
)

/** The folders that are open right now. Absent from it is collapsed, which is
 *  the default. */
export const openFolders: Accessor<ReadonlySet<string>> = folders

/** Open a folder, or shut it, and remember which. `live` prunes on the way past
 *  — see the header, and ./memory.ts for why a write is when to do it. */
export const toggleFolder = (path: string, live: ReadonlySet<string>): void => {
  const next = new Set(folders())
  if (!next.delete(path)) next.add(path)
  const kept = prunedFolders(next, live)
  setFolders(kept)
  writePreference(FOLDERS_KEY, printFolders(kept))
}

/** Follow it for as long as this document lives — a folder opened in another
 *  tab lands here, exactly as a fold does. */
export const followFolders = (): void => {
  watchPreference(FOLDERS_KEY, (value) => setFolders(parseFolders(value)))
}
