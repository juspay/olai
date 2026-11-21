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
import { resolveRelative } from "./documents.ts"
import { type Claims, fileKind, holdsBody, stemOf } from "./kinds.ts"
import { basenameOf, byPath } from "./paths.ts"
import { slugOf } from "@olai/prose/slug.ts"
import { nearestId } from "./suggest.ts"

/**
 * The directory's files by name, folded — one membership's worth.
 *
 * WHO HOLDS ONE: a revision's reading carries its own ({@link ./validate.ts}'s
 * `Reading.names`), built at the first load and handed on untouched by every
 * revision that brings no path in and takes none away ({@link namesCarried});
 * the browser asks {@link namesIn} of the membership snapshot the vault
 * plugin publishes, which is replaced only when a path arrives or leaves.
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
   *  ({@link wikilinkKey}) — a fixed fact of the path and the claims, worked
   *  out once here so a read is one lookup. A path it does not hold has no
   *  entry, and no wikilink finds it. */
  readonly keys: ReadonlyMap<string, string>
  /**
   * WHERE EACH NAME LANDS, as it is asked ({@link wikilinkAddress}) — by the
   * writer's folder and the name, since nothing else of the writer moves the
   * answer. Held here because the answer is a fact of this membership: it is
   * dropped with the object when a path arrives or leaves, and every revision
   * between hands it on, so a page asking again does lookups.
   */
  readonly found: Map<string, Address | null>
}

/** Capitals and the stored form of an accented letter set aside. ASCII has
 *  one stored form, so only other text pays for normalising. */
const fold = (text: string): string => (ASCII.test(text) ? text : text.normalize("NFC")).toLowerCase()

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

/** Remembered against the membership snapshot it was built from, which is
 *  replaced, never mutated, when the directory's files change. */
const NAMES = new WeakMap<object, Names>()

/**
 * The name index of the browser's membership snapshot — the same snapshot and
 * claims answer the same object, so a page drawing a hundred links builds it
 * once, and a file arriving (a new snapshot) builds it again.
 */
export const namesIn = (claims: Claims, served: ReadonlySet<string>): Names => {
  const held = NAMES.get(served)
  if (held !== undefined && held.claims === claims) return held
  const names = namesOf(claims, served)
  NAMES.set(served, names)
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
 * An empty target is a heading of the writing DOCUMENT itself; written
 * anywhere else — a row of an outline, an agent's answer — it has no file to
 * be a heading of, and names nothing.
 */
export const wikilinkAddress = (names: Names, claims: Claims, from: string, name: string): Address | null => {
  if (claims !== names.claims) return landing(names, claims, from, name)
  // What a name finds depends on the writer's FOLDER and nothing else of it
  // ({@link wikilinkPath}), except a link to the writer's own heading, which
  // is about the writer itself.
  const key = `${name.startsWith("#") || name === "" ? from : folderOf(from)}\0${name}`
  const held = names.found.get(key)
  if (held !== undefined) return held
  const found = landing(names, claims, from, name)
  names.found.set(key, found)
  return found
}

const landing = (names: Names, claims: Claims, from: string, name: string): Address | null => {
  const parts = name.split("#")
  const target = parts[0] as string
  const path = target === ""
    ? (holdsBodyAt(claims, from) ? from : null)
    : wikilinkPath(names, claims, from, target)
  if (path === null) return null
  const last = parts.length > 1 ? (parts[parts.length - 1] as string) : ""
  if (last === "" || last.startsWith("^")) return addressOf(claims, path, null)
  return addressOf(claims, path, holdsBodyAt(claims, path) ? slugOf(last) : last)
}

/** Whether a path is a file whose content is a body — one with headings. */
const holdsBodyAt = (claims: Claims, path: string): boolean => {
  const kind = path === "" ? null : fileKind(claims, path)
  return kind !== null && holdsBody(claims, kind)
}

/**
 * The key a wikilink is FILED under in the references index: its target's last
 * segment, folded, behind a `[[` no printed address can start with — and a
 * document's name without its suffix, so `[[finishes]]` and `[[finishes.md]]`
 * share one key, which is the one {@link Names.keys} holds for `finishes.md`.
 * `null` for a link to the writing file's own heading, which refers to
 * nothing else.
 *
 * Filed by what is WRITTEN, the way an `@mention` is filed by its word, so
 * that a file arriving or leaving never makes anyone re-read another file:
 * the reading resolves each link it finds under the key the name index holds
 * for the file it asks about.
 */
export const wikilinkKey = (claims: Claims, name: string): string | null => {
  const cut = name.indexOf("#")
  const base = basenameOf(cut === -1 ? name : name.slice(0, cut))
  if (base === "") return null
  return `[[${fold(isProse(claims, base) ? stemOf(claims, base) : base)}`
}

/**
 * The NODE a wikilink to a ROW is filed under as well —
 * `[[house.olai#kitchen]]` under `#kitchen` — so the node arm of the reading
 * finds it under the key it already reads. A row is named by an outline's
 * suffix and a last `#` part, which is all this reads; which file the name
 * finds, and whether that file draws the row, is still the reading's
 * question. `null` for every other wikilink.
 */
export const wikilinkRowNode = (claims: Claims, name: string): Address | null => {
  const parts = name.split("#")
  const target = parts[0] as string
  const last = parts.length > 1 ? (parts[parts.length - 1] as string) : ""
  if (target === "" || last === "" || last.startsWith("^")) return null
  const kind = fileKind(claims, target)
  if (kind === null || claims.byKind.get(kind)?.holds !== "nodes") return null
  const node = addressOf(claims, null, last)
  return node?.kind === "node" ? node : null
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

/**
 * THE SHORTEST TEXT a wikilink written in `from` can name `path` by, so that
 * {@link wikilinkPath} takes it back to that very file: the name alone when
 * that is enough, otherwise its path from the top of the directory. A
 * document is written without its suffix and every other file with it, so an
 * outline is `house.olai`.
 */
export const wikilinkFor = (names: Names, claims: Claims, from: string, path: string): string => {
  const name = spelledName(claims, path)
  if (wikilinkPath(names, claims, from, name) === path) return name
  const whole = path.slice(0, path.length - basenameOf(path).length) + name
  return wikilinkPath(names, claims, from, whole) === path ? whole : path
}

/** One file a wikilink being typed may name: what it is called and where it
 *  is. */
export interface WikilinkOffer {
  readonly path: string
  /** Its name as a wikilink writes it — a document's without its suffix. */
  readonly name: string
}

/** The characters a wikilink cannot carry in a name: its own punctuation. */
const UNWRITABLE = /[[\]|#^]/

/**
 * The files a wikilink being typed may name, for what has been typed: the
 * Markdown documents whose name holds it, capitals ignored, and after them
 * every other served file whose name does, each in path order. A file whose
 * name a wikilink cannot spell (a `#`, a `|`, a bracket) is not offered.
 */
export const wikilinkOffers = (names: Names, claims: Claims, query: string, limit: number): ReadonlyArray<WikilinkOffer> => {
  const wanted = fold(query.trim())
  // A `/` typed is a folder typed: then the whole path is what must hold it.
  const pathed = wanted.includes("/")
  const documents: Array<WikilinkOffer> = []
  const others: Array<WikilinkOffer> = []
  for (const paths of names.everything.values()) {
    for (const path of paths) {
      if (UNWRITABLE.test(path)) continue
      const name = spelledName(claims, path)
      const said = pathed ? path.slice(0, path.length - basenameOf(path).length) + name : name
      if (!fold(said).includes(wanted)) continue
      ;(isProse(claims, path) ? documents : others).push({ path, name })
    }
  }
  const byOffer = (one: WikilinkOffer, other: WikilinkOffer): number => byPath(one.path, other.path)
  return [...documents.sort(byOffer), ...others.sort(byOffer)].slice(0, limit)
}

/**
 * The page an UNRESOLVED wikilink opens: the path its target would have if it
 * were written at the top of the directory — a document's suffix added to a
 * bare name — so a click reaches **Page not found** for that name, as a dead
 * standard link does. `null` for a target that spells no path at all.
 *
 * A `..` that would climb out of the directory is dropped, as a standard
 * link's is, and a leading `/` is only a name: the answer is always a path
 * under the served root, never a host or a scheme.
 */
export const wikilinkFallback = (claims: Claims, target: string): string | null => {
  const path = resolveRelative("", target.replaceAll("\\", "/"))
  if (path === "") return null
  if (hasSuffix(claims, path)) return path
  for (const claim of claims.byKind.values()) {
    if (claim.holds === "text" && claim.kept && claim.opaque !== true) return path + (claim.exts[0] as string)
  }
  return null
}

/**
 * Whether a target names a PICTURE by its suffix — any kind that draws inline,
 * including the suffixes it serves inert (`.svg`). An embed of one is drawn as
 * the picture, or as words saying why it is not; an embed of anything else
 * draws as a link.
 */
export const wikilinkPicture = (claims: Claims, target: string): boolean => {
  const lower = target.toLowerCase()
  for (const claim of claims.byKind.values()) {
    if (claim.picture === true && claim.exts.some((ext) => lower.endsWith(ext.toLowerCase()))) return true
  }
  return false
}
