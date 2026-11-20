import { ROW_DIM } from "./chrome.ts"
import { NO_NEEDLES } from "@olai/markdown-ui/lit.ts"
import type { Narrowed } from "./filter.tsx"

export const matchedAttr = (
  narrowed: Narrowed,
  id: string,
): string | undefined => {
  const found = matchOf(narrowed, id)
  return found === undefined ? undefined : String(found)
}

export const unfiltered = (narrowed: Narrowed): boolean => !narrowed.active()

export const lighting = (
  narrowed: Narrowed,
  id: string,
): ReadonlyArray<string> =>
  matchOf(narrowed, id) === true ? narrowed.needles() : NO_NEEDLES

export const asContext = (narrowed: Narrowed, id: string): boolean =>
  matchOf(narrowed, id) === false

export const CONTEXT_DIM = (narrowed: Narrowed, id: string): string =>
  asContext(narrowed, id) ? ROW_DIM : ""

export const behindTheMark = (
  narrowed: Narrowed,
  id: string,
): ReadonlyArray<string> =>
  (narrowed.behind ? narrowed.behind(id) : narrowed.selected()?.get(id)?.matched === "desc") ? narrowed.needles() : NO_NEEDLES

const matchOf = (narrowed: Narrowed, id: string): boolean | undefined =>
  narrowed.matchOf ? narrowed.matchOf(id) : narrowed.selected()?.has(id)
