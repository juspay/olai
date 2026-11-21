/**
 * THE NAME INDEX OF A MEMBERSHIP — the directory's files by name, folded, so
 * a wikilink's name is found by lookups (`./wikilink.ts` is the rule that
 * reads it).
 */
import type { Address } from "../address.ts"
import { type Claims, fileKind, stemOf } from "../kinds.ts"
import { basenameOf, byPath } from "../paths.ts"

/**
 * The directory's files by name, folded — one membership's worth.
 *
 * WHO HOLDS ONE: a revision's reading carries its own (`../validate.ts`'s
 * `Reading.names`), built at the first load and handed on untouched by every
 * revision that brings no path in and takes none away ({@link namesCarried});
 * in the browser the vault plugin's served directory publishes one beside its
 * membership (`plugins/vault/src/browser/directory.ts`), built with
 * {@link namesOf} from the paths it holds and dropped, with a fresh one in its
 * place, when a path arrives or leaves.
 */
export interface Names {
  readonly claims: Claims
  /** Every path it was built from. */
  readonly served: ReadonlySet<string>
  /** Folded stem of each Markdown document → its paths, in path order. */
  readonly documents: ReadonlyMap<string, ReadonlyArray<string>>
  /** Folded basename of each served file → its paths, in path order. */
  readonly everything: ReadonlyMap<string, ReadonlyArray<string>>
  /** Folded stem of each served file, of any kind → its paths. What a
   *  suggestion for an unresolved name reads. */
  readonly stems: ReadonlyMap<string, ReadonlyArray<string>>
  /** Each served path → the key a wikilink to it is filed under
   *  (`./wikilink.ts`'s `wikilinkKey`) — a fixed fact of the path and the claims, worked
   *  out once here so a read is one lookup. A path it does not hold has no
   *  entry, and no wikilink finds it. */
  readonly keys: ReadonlyMap<string, string>
  /**
   * WHERE EACH NAME LANDS, as it is asked (`./wikilink.ts`'s `wikilinkAddress`) — by the
   * writer's folder and the name, since nothing else of the writer moves the
   * answer. Held here because the answer is a fact of this membership: it is
   * dropped with the object when a path arrives or leaves, and every revision
   * between hands it on, so a page asking again does lookups.
   */
  readonly found: Map<string, Address | null>
}

/** Capitals and the stored form of an accented letter set aside. ASCII has
 *  one stored form, so only other text pays for normalising. */
export const fold = (text: string): string => (ASCII.test(text) ? text : text.normalize("NFC")).toLowerCase()

const ASCII = /^[\x00-\x7f]*$/

/** The name index of these paths, built. */
export const namesOf = (claims: Claims, paths: Iterable<string>): Names => {
  const served = new Set(paths)
  const documents = new Map<string, Array<string>>()
  const everything = new Map<string, Array<string>>()
  const stems = new Map<string, Array<string>>()
  const keys = new Map<string, string>()
  for (const path of [...served].sort(byPath)) {
    const whole = fold(basenameOf(path))
    filed(everything, whole, path)
    const stem = fold(stemOf(claims, path))
    filed(stems, stem, path)
    const prose = isProse(claims, path)
    if (prose) filed(documents, stem, path)
    keys.set(path, `[[${prose ? stem : whole}`)
  }
  return { claims, served, documents, everything, stems, keys, found: new Map() }
}

/**
 * The name index of the revision after this one: the very object it was when
 * no path arrived and none left, which is nearly every revision — a keystroke
 * writes a file that was already there — and a fresh one otherwise. `was` and
 * `now` are the two revisions' documents, both in path order, so telling is
 * one step through the pair.
 */
export const namesCarried = (
  before: Names,
  claims: Claims,
  was: ReadonlyArray<{ readonly path: string }>,
  now: ReadonlyArray<{ readonly path: string }>,
): Names => {
  if (before.claims === claims && was.length === now.length && was.every((one, at) => one.path === now[at]?.path)) {
    return before
  }
  return namesOf(claims, now.map((one) => one.path))
}

const filed = (into: Map<string, Array<string>>, key: string, path: string): void => {
  const held = into.get(key)
  if (held === undefined) into.set(key, [path])
  else held.push(path)
}

/** Whether a path is a Markdown document: text the directory keeps and reads
 *  as prose. */
export const isProse = (claims: Claims, path: string): boolean => {
  const kind = fileKind(claims, path)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  return claim !== undefined && claim.holds === "text" && claim.kept && claim.opaque !== true
}

/** Whether a name ends in a suffix some claim serves, capitals aside. */
export const hasSuffix = (claims: Claims, name: string): boolean => {
  const lower = name.toLowerCase()
  for (const ext of claims.byExt.keys()) {
    if (lower.length > ext.length && lower.endsWith(ext.toLowerCase())) return true
  }
  return false
}

