/** File membership is a snapshot supplied by the vault, never a built-in roster. */
import { Schema } from "effect"
import type { OutlineFormat } from "./format.ts"
import { basenameOf } from "./paths.ts"

/** The data part of a claim, shared by wire readings. */
export const ClaimData = Schema.Struct({
  kind: Schema.String, exts: Schema.NonEmptyArray(Schema.String),
  holds: Schema.Literals(["nodes", "text", "bytes"]),
  kept: Schema.Boolean, fetched: Schema.Boolean, noun: Schema.String,
  article: Schema.Literals(["a", "an"]),
  /** The vault wraps fetched pages in its sealed iframe document. */
  serving: Schema.optionalKey(Schema.Literal("sealed-frame")),
  /** Case-folded picture references may be served and drawn inline. */
  picture: Schema.optionalKey(Schema.Boolean),
  /** Claimed suffixes served inert and excluded from inline pictures. */
  inert: Schema.optionalKey(Schema.Array(Schema.String)),
  /**
   * WHERE THIS CLAIM APPLIES — a path prefix, ending in `/`, or absent for a
   * claim that applies everywhere, which is what every claim but one is.
   *
   * A suffix is enough to name a kind when the suffix is olai's: nothing but an
   * outline is a `.olai`. It is not enough for `.ts`, which names a file a
   * vault is likely to be full of for reasons that have nothing to do with
   * olai — a checkout beside the notes. A claim that scoped itself to
   * `plugins/` says what it means: the two halves of a plugin this vault
   * defines, and no other TypeScript in the directory.
   */
  under: Schema.optionalKey(Schema.String),
  /**
   * A FILE OF THIS KIND IS REACHED FROM SOMEWHERE OF THE CLAIMING ROW'S OWN,
   * so the sidebar's file trees leave it out.
   *
   * Not a secret and not unreadable: it is in the set, it is in the ledger, the
   * Commit panel lists it, and an address names it. What it is not is a row in
   * the Reference tree — because the row that claimed it draws a better place
   * to open it from, and two front doors onto the same file is how a sidebar
   * fills up with the app's own plumbing.
   */
  elsewhere: Schema.optionalKey(Schema.Boolean),
  /**
   * ITS TEXT IS KEPT AND NOBODY READS IT AS PROSE — the second half of a fact
   * `kept` was carrying alone, and the only claim in the tree that says it.
   *
   * `kept` is about STORAGE: the body travels on the revision, so a write gate
   * can refuse to overwrite bytes nobody has seen and a page can draw the file
   * without a second fetch. Every kept claim but one wanted a second thing
   * along with it — that the text is MARKDOWN, with a first line for a title,
   * `#topic`s for tags, `[…](…)`s for links and a `---` block for properties —
   * and nothing in the table said so, so "it has a body" was read as "read it"
   * everywhere the two happened to coincide.
   *
   * They stop coinciding at a plugin's halves. `server.ts` opens with an
   * import line, writes `#rrggbb` in a sentence about a colour and `#todo` in
   * a comment, and none of those is a title or a tag: they are TypeScript.
   * Reading them as prose put two documents per plugin into the tag
   * vocabulary, the search index, `markdown_index` and every document picker,
   * each titled with its first import.
   *
   * ABSENT IS PROSE, which is the right default for a table whose other five
   * rows are a vault's own writing and whose sixth is code: a claim that says
   * nothing about this is read the way `.md` has always been read, and a row
   * added tomorrow inherits the reading rather than a silence. What the flag
   * takes away is the READING and never the standing: the body is still in the
   * revision, still writable, still committed, still addressable
   * ({@link ./document.ts}'s `isKeptText` is that half, `isMarkdown` this one).
   */
  opaque: Schema.optionalKey(Schema.Literal(true)),
})
/** A registered claim adds its server-only parser to the serializable policy. */
export interface Claim extends Schema.Schema.Type<typeof ClaimData> {
  readonly format?: OutlineFormat
}
export const FileKind = Schema.String

/** An inert snapshot of one vault's claims, never a service or a default. */
export interface Claims {
  readonly byKind: ReadonlyMap<string, Claim>
  readonly byExt: ReadonlyMap<string, string>
}

/** Build an independent snapshot. Ambiguous suffixes are refused in either
 * insertion order; the caller receives no partially built table. */
export const claims = (list: Iterable<Claim>): Claims => {
  const byKind = new Map<string, Claim>()
  const byExt = new Map<string, string>()
  for (const claim of list) {
    if (byKind.has(claim.kind)) throw new Error(`file kinds: a second claim from "${claim.kind}"`)
    if (claim.exts.length === 0) throw new Error(`file kinds: "${claim.kind}" claims no suffix`)
    for (const ext of claim.exts) {
      if (!ext.startsWith(".") || ext.length < 2 || /[\\/\s]/.test(ext)) {
        throw new Error(`file kinds: invalid suffix "${ext}"`)
      }
      for (const [previous, owner] of byExt) {
        if (ext.endsWith(previous) || previous.endsWith(ext)) {
          throw new Error(`file kinds: "${claim.kind}" claims "${ext}", overlapping "${previous}" claimed by "${owner}"`)
        }
      }
      byExt.set(ext, claim.kind)
    }
    byKind.set(claim.kind, Object.freeze({ ...claim, ...(claim.inert === undefined ? {} : { inert: Object.freeze([...claim.inert]) }), exts: Object.freeze([...claim.exts]) as Claim["exts"] }))
  }
  return Object.freeze({ byKind, byExt })
}

/**
 * THE CLAIM A PATH FALLS UNDER, or none.
 *
 * A suffix is the whole of the question for five of the six kinds. It cannot be
 * for the sixth: `.ts` names a TypeScript file, and a vault that keeps a build
 * beside its notes is full of them — so a bare suffix claim would sweep every
 * one into the sidebar's Reference tree and into the revision's memory. {@link
 * Claim.under} is the answer: a claim may say WHERE it applies, and a path
 * outside that folder is unclaimed, exactly as it was before the claim existed.
 *
 * A SCOPED CLAIM OWNS ITS SUFFIX OUTRIGHT, and the scope narrows which PATHS
 * it answers for rather than which claims may hold the suffix: {@link claims}
 * refuses a second row over `.ts` (and over any suffix that ends in one
 * already taken), so there is no unscoped claim behind this one to fall
 * through to. The walk therefore continues past a match the path is outside
 * the scope of only to finish the table — a `.ts` in a checkout beside the
 * notes leaves this loop unclaimed, which is the whole point of the scope.
 */
const claimOf = (claims: Claims, path: string): Claim | undefined => {
  for (const [ext, owner] of claims.byExt) {
    if (!path.endsWith(ext)) continue
    const claim = claims.byKind.get(owner)
    if (claim !== undefined && (claim.under === undefined || path.startsWith(claim.under))) return claim
  }
  return undefined
}
export const fileKind = (claims: Claims, path: string): string | null => claimOf(claims, path)?.kind ?? null
/** The path without the suffix that claimed it, and the whole path when
 *  nothing claims it. */
export const bareOf = (claims: Claims, path: string): string => withoutExt(claimOf(claims, path), path)
/** ...and the same, of the basename — asked of the FULL path, so a scoped
 *  claim is judged where the file actually is rather than on a bare name that
 *  has had its folder cut off. */
export const stemOf = (claims: Claims, path: string): string =>
  withoutExt(claimOf(claims, path), path.slice(path.lastIndexOf("/") + 1))
const withoutExt = (claim: Claim | undefined, name: string): string => {
  for (const ext of claim?.exts ?? []) if (name.endsWith(ext)) return name.slice(0, -ext.length)
  return name
}
/** The name a file is drawn by, in the sidebar and in a tab alike: a document
 * (a kept kind — an outline, a markdown file) drops the suffix that claimed it
 * (`garden.olai` is `garden`); every other file keeps it, since the suffix is
 * how a person tells `report.pdf` from `report.csv`. */
export const nameOf = (claims: Claims, path: string): string => {
  const claim = claimOf(claims, path)
  const base = basenameOf(path)
  return claim?.kept === true ? withoutExt(claim, base) : base
}
export const holdsBody = (claims: Claims, kind: string): boolean => {
  const claim = claims.byKind.get(kind)
  return claim !== undefined && claim.holds !== "nodes"
}
export const holdsText = (claims: Claims, kind: string): boolean => claims.byKind.get(kind)?.holds === "text"
export const bodyKind = (claims: Claims, path: string): string | null => {
  const claim = claimOf(claims, path)
  return claim !== undefined && claim.holds !== "nodes" ? claim.kind : null
}
export const textKind = (claims: Claims, path: string): string | null => {
  const claim = claimOf(claims, path)
  return claim?.holds === "text" ? claim.kind : null
}
export const unkept = (claims: Claims, path: string): boolean => claimOf(claims, path)?.kept === false
export const isFetched = (claims: Claims, path: string): boolean => claimOf(claims, path)?.fetched === true
export const mintExt = (claims: Claims, kind: string): string | null => claims.byKind.get(kind)?.exts[0] ?? null
export const parserFor = (claims: Claims, path: string): OutlineFormat | null => claimOf(claims, path)?.format ?? null

/** An unclaimed path cannot name an absent row. */
export const noClaimFor = (path: string): string => {
  const suffix = /\.[^./]+$/.exec(path)?.[0]
  return suffix === undefined ? "no row claims a path without a suffix" : `no row claims \`${suffix}\``
}
export const unclaimedFileMessage = (path: string): string => `The directory holds nothing by the name ${path}. ${noClaimFor(path).replace(/^n/, "N")}.`
