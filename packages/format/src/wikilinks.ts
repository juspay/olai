/**
 * WHICH FILE A WIKILINK'S NAME FINDS — one rule, asked by the page, by the
 * references reading and by what an agent is told.
 *
 * A standard link is a path beside the file that wrote it, so it means the
 * same thing whatever the directory holds. A wikilink is a NAME looked up
 * across the whole directory, so its answer moves with membership: a file
 * arriving can heal it, and a second file of the same name nearer the writer
 * can re-aim it. Nothing here files that answer away. The index files a
 * wikilink under the name as written ({@link wikilinkKey}), and every reader
 * asks this module when it reads.
 *
 * ## The rule
 *
 * 1. The name is the text before any `|` and `#`, trimmed (`./documents.ts`'s
 *    scan has already cut it).
 * 2. A name ending in a suffix the directory serves may match any served file.
 *    A name with no suffix matches a Markdown document only, so an outline is
 *    written `[[house.olai]]`.
 * 3. A name with a `/` is tried as a path from the top of the directory, then
 *    beside the writing file, then as the end of any file's path. A name with
 *    a `./` or `../` segment is read beside the writing file only, and one
 *    that climbs out of the directory finds nothing.
 * 4. A name with no `/` collects every file of that name. Of several, the one
 *    in the writer's folder wins, then the one with the fewest folders above
 *    it, then the first in path order.
 * 5. Capitals and how an accented letter is stored do not matter, but a file
 *    whose capitals match exactly is preferred over one that does not.
 */
import { type Address, addressOf } from "./address.ts"
import { type Claims, fileKind, holdsBody, stemOf } from "./kinds.ts"
import { basenameOf, byPath } from "./paths.ts"
import { slugOf } from "./slug.ts"
import { nearestId } from "./suggest.ts"

/** The directory's files by name, folded — built once per membership
 *  snapshot ({@link namesIn}). */
export interface Names {
  /** Folded stem of each Markdown document → its paths, in path order. */
  readonly documents: ReadonlyMap<string, ReadonlyArray<string>>
  /** Folded basename of each served file → its paths, in path order. */
  readonly everything: ReadonlyMap<string, ReadonlyArray<string>>
  /** Folded stem of each served file, of any kind → its paths. What a
   *  suggestion for an unresolved name reads. */
  readonly stems: ReadonlyMap<string, ReadonlyArray<string>>
}

/** Capitals and the stored form of an accented letter set aside. */
const fold = (text: string): string => text.normalize("NFC").toLowerCase()

/** Remembered against the membership snapshot it was built from, which is
 *  replaced, never mutated, when the directory's files change. */
const NAMES = new WeakMap<object, { readonly claims: Claims; readonly names: Names }>()

/**
 * The name index of one membership snapshot — the browser's served set, or the
 * set of a revision's paths. The same snapshot and claims answer the same
 * object, so a page drawing a hundred links builds it once.
 */
export const namesIn = (claims: Claims, served: ReadonlySet<string> | ReadonlyArray<string>): Names => {
  const held = NAMES.get(served)
  if (held !== undefined && held.claims === claims) return held.names
  const documents = new Map<string, Array<string>>()
  const everything = new Map<string, Array<string>>()
  const stems = new Map<string, Array<string>>()
  for (const path of [...served].sort(byPath)) {
    filed(everything, fold(basenameOf(path)), path)
    const stem = fold(stemOf(claims, path))
    filed(stems, stem, path)
    if (isProse(claims, path)) filed(documents, stem, path)
  }
  const names: Names = { documents, everything, stems }
  NAMES.set(served, { claims, names })
  return names
}

const filed = (into: Map<string, Array<string>>, key: string, path: string): void => {
  const held = into.get(key)
  if (held === undefined) into.set(key, [path])
  else held.push(path)
}

/** Whether a path is a Markdown document: text the directory keeps and reads
 *  as prose. */
const isProse = (claims: Claims, path: string): boolean => {
  const kind = fileKind(claims, path)
  const claim = kind === null ? undefined : claims.byKind.get(kind)
  return claim !== undefined && claim.holds === "text" && claim.kept && claim.opaque !== true
}

/** Whether a name ends in a suffix some claim serves, capitals aside. */
const hasSuffix = (claims: Claims, name: string): boolean => {
  const lower = name.toLowerCase()
  for (const ext of claims.byExt.keys()) {
    if (lower.length > ext.length && lower.endsWith(ext.toLowerCase())) return true
  }
  return false
}

/**
 * The served path a wikilink's target finds from the file `from`, or `null`.
 *
 * `target` is the name before any `#`. An empty one, one that opens with `/`
 * and one with a backslash name no file: an address is only ever one this
 * rule found among the served paths.
 */
export const wikilinkPath = (names: Names, claims: Claims, from: string, target: string): string | null => {
  if (target === "" || target.startsWith("/") || target.includes("\\")) return null
  const suffixed = hasSuffix(claims, target)
  const pool = suffixed ? names.everything : names.documents
  const candidates = pool.get(fold(basenameOf(target)))
  if (candidates === undefined) return null
  // What a candidate is called for this comparison: its whole path when the
  // name carries a suffix, and its path without one when it does not.
  const spelled = (path: string): string =>
    suffixed ? path : path.slice(0, path.length - basenameOf(path).length) + stemOf(claims, path)
  const wanted = target.normalize("NFC")
  if (!target.includes("/")) {
    return chosen(candidates, from, (path) => basenameOf(spelled(path)).normalize("NFC") === wanted)
  }
  const relative = target.split("/").some((segment) => segment === "." || segment === "..")
  if (!relative) {
    const top = fold(target)
    const hits = candidates.filter((path) => fold(spelled(path)) === top)
    if (hits.length > 0) return chosen(hits, from, (path) => spelled(path).normalize("NFC") === wanted)
  }
  const beside = besideOf(from, target)
  if (beside !== null) {
    const folded = fold(beside)
    const hits = candidates.filter((path) => fold(spelled(path)) === folded)
    const exact = beside.normalize("NFC")
    if (hits.length > 0) return chosen(hits, from, (path) => spelled(path).normalize("NFC") === exact)
  }
  if (relative) return null
  const tail = "/" + fold(target)
  const hits = candidates.filter((path) => fold(spelled(path)).endsWith(tail))
  return hits.length === 0 ? null : chosen(hits, from, (path) => spelled(path).normalize("NFC").endsWith("/" + wanted))
}

/** `target` joined onto the folder of `from`, or `null` when a `..` climbs
 *  out of the directory. */
const besideOf = (from: string, target: string): string | null => {
  const segments = from.split("/").slice(0, -1)
  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") continue
    if (segment === "..") {
      if (segments.length === 0) return null
      segments.pop()
    } else segments.push(segment)
  }
  return segments.join("/")
}

/** The one of several matches a name means: exact capitals first, then the
 *  writer's folder, then the fewest folders, then path order (the order the
 *  candidates are already in). */
const chosen = (hits: ReadonlyArray<string>, from: string, exact: (path: string) => boolean): string => {
  const cased = hits.filter(exact)
  const pool = cased.length > 0 ? cased : hits
  if (pool.length === 1) return pool[0] as string
  const folder = folderOf(from)
  const near = pool.find((path) => folderOf(path) === folder)
  if (near !== undefined) return near
  let best = pool[0] as string
  let depth = depthOf(best)
  for (const path of pool) {
    const here = depthOf(path)
    if (here < depth) {
      best = path
      depth = here
    }
  }
  return best
}

const folderOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")))

const depthOf = (path: string): number => {
  let depth = 0
  for (let at = 0; at < path.length; at++) if (path.charCodeAt(at) === 0x2f) depth++
  return depth
}

/**
 * The address a wikilink's name lands on from `from`, or `null` when it finds
 * nothing.
 *
 * `name` is the target and its `#` parts (`./documents.ts`'s
 * `Wikilink.name`). The LAST part is the one it lands on: a heading of a
 * document by its slug, the way olai names headings, or a row of an outline by
 * its id. A part opening with `^` is a block reference, which opens the file.
 * An empty target is a heading of the writing file itself.
 */
export const wikilinkAddress = (names: Names, claims: Claims, from: string, name: string): Address | null => {
  const parts = name.split("#")
  const target = parts[0] as string
  const path = target === ""
    ? (from === "" || fileKind(claims, from) === null ? null : from)
    : wikilinkPath(names, claims, from, target)
  if (path === null) return null
  const last = parts.length > 1 ? (parts[parts.length - 1] as string) : ""
  if (last === "" || last.startsWith("^")) return addressOf(claims, path, null)
  const kind = fileKind(claims, path)
  return addressOf(claims, path, kind !== null && holdsBody(claims, kind) ? slugOf(last) : last)
}

/**
 * The key a wikilink is FILED under in the references index: its target's last
 * segment, folded, behind a `[[` no printed address can start with. `null` for
 * a link to the writing file's own heading, which refers to nothing else.
 *
 * Filed by what is WRITTEN, the way an `@mention` is filed by its word, so
 * that a file arriving or leaving never makes anyone re-read another file:
 * the reading resolves each link it finds under {@link wikilinkKeys}.
 */
export const wikilinkKey = (name: string): string | null => {
  const cut = name.indexOf("#")
  const base = basenameOf(cut === -1 ? name : name.slice(0, cut))
  return base === "" ? null : `[[${fold(base)}`
}

/** The keys a link to `path` may be filed under: its whole name, and, for a
 *  Markdown document, its name without the suffix. */
export const wikilinkKeys = (claims: Claims, path: string): ReadonlyArray<string> => {
  const whole = `[[${fold(basenameOf(path))}`
  return isProse(claims, path) ? [whole, `[[${fold(stemOf(claims, path))}`] : [whole]
}

/**
 * The names an agent is offered for a target that finds nothing, each written
 * as a wikilink: every file whose name is the target's with a suffix
 * (`[[house]]` → `[[house.olai]]`), or else the nearest document name.
 */
export const wikilinkSuggestions = (names: Names, claims: Claims, target: string): ReadonlyArray<string> => {
  const base = fold(basenameOf(target))
  if (base === "") return []
  const same = (names.stems.get(base) ?? []).map((path) => `[[${spelledName(claims, path)}]]`)
  if (same.length > 0) return [...new Set(same)]
  const nearest = nearestId(base, names.documents.keys())
  const path = nearest === null ? undefined : names.documents.get(nearest)?.[0]
  return path === undefined ? [] : [`[[${spelledName(claims, path)}]]`]
}

/** A file's name as a wikilink writes it: a document without its suffix,
 *  every other file with it. */
const spelledName = (claims: Claims, path: string): string =>
  isProse(claims, path) ? stemOf(claims, path) : basenameOf(path)
