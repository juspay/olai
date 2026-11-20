import { isKeptText } from "@olai/format"
import type { Claims } from "@olai/format"
import {
  brokenBy,
  type Document,
  documentAt,
  type Markdown,
  markdownAt,
  type OutlineError,
  type OutlineSet,
  outlineNames,
  outlinePaths,
} from "@olai/format"

export interface Asked {
  readonly claims: Claims
  readonly set: OutlineSet
  readonly outlines: ReadonlyArray<string>
  readonly serves: ReadonlySet<string>
  readonly broken: ReadonlyMap<string, ReadonlyArray<OutlineError>>
  readonly at: (path: string) => Document | undefined
  readonly markdown: (path: string) => Markdown | undefined
}

export const askedOf = (claims: Claims, set: OutlineSet): Asked => ({
  claims,
  set,
  get outlines() {
    return outlinePaths(set)
  },
  get serves() {
    return outlineNames(set)
  },
  get broken() {
    return brokenBy(set)
  },
  at: (path) => documentAt(set, path),
  markdown: (path) => markdownAt(set, path),
})

export const carried = (
  base: Asked,
  set: OutlineSet,
  written: ReadonlyMap<string, Document>,
): Asked | undefined => {
  for (const path of written.keys()) {
    if (base.at(path) === undefined || base.broken.has(path)) return undefined
  }
  return {
    claims: base.claims,
    set,
    get outlines() {
      return base.outlines
    },
    get serves() {
      return base.serves
    },
    get broken() {
      return base.broken
    },
    at: (path) => written.get(path) ?? base.at(path),
    markdown: (path) => {
      const found = written.get(path)
      if (found !== undefined) return isKeptText(found) ? found : undefined
      return markdownAt(set, path)
    },
  }
}
