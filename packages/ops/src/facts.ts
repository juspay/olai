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
  type Reading,
} from "@olai/format"

export interface SetFacts {
  readonly claims: Claims
  readonly set: OutlineSet
  readonly outlines: ReadonlyArray<string>
  readonly serves: ReadonlySet<string>
  readonly broken: ReadonlyMap<string, ReadonlyArray<OutlineError>>
  readonly at: (path: string) => Document | undefined
  readonly markdown: (path: string) => Markdown | undefined
}

export const factsOf = (claims: Claims, set: OutlineSet): SetFacts => ({
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

export const carriedOrFresh = (
  base: SetFacts,
  at: Reading,
  written: ReadonlyMap<string, Document>,
): { readonly facts: SetFacts; readonly carried: boolean } => {
  for (const path of written.keys()) {
    if (base.at(path) === undefined || base.broken.has(path)) {
      return { facts: factsOf(at.claims, at.set), carried: false }
    }
  }
  return {
    carried: true,
    facts: {
      claims: base.claims,
      set: at.set,
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
        return markdownAt(at.set, path)
      },
    },
  }
}
