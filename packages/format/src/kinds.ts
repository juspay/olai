/** File membership is a snapshot supplied by the vault, never a built-in roster. */
import { Schema } from "effect"
import type { OutlineFormat } from "./format.ts"

export interface Claim {
  readonly kind: string
  readonly exts: readonly [string, ...string[]]
  readonly holds: "nodes" | "text" | "bytes"
  readonly kept: boolean
  readonly fetched: boolean
  /** The vault wraps fetched pages in its sealed iframe document. */
  readonly serving?: "sealed-frame"
  /** Case-folded picture references may be served and drawn inline. */
  readonly picture?: boolean
  /** Claimed suffixes served with inert headers and excluded from inline pictures. */
  readonly inert?: readonly string[]
  readonly noun: string
  readonly article: "a" | "an"
  readonly format?: OutlineFormat
}

/** The wire carries an owner's id; membership is checked against a snapshot. */
/** The data part of a claim, shared by wire readings. */
export const ClaimData = Schema.Struct({
  kind: Schema.String, exts: Schema.NonEmptyArray(Schema.String),
  holds: Schema.Literals(["nodes", "text", "bytes"]),
  kept: Schema.Boolean, fetched: Schema.Boolean, noun: Schema.String,
  article: Schema.Literals(["a", "an"]),
  serving: Schema.optionalKey(Schema.Literal("sealed-frame")),
  picture: Schema.optionalKey(Schema.Boolean),
  inert: Schema.optionalKey(Schema.Array(Schema.String)),
})
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

const claimOf = (claims: Claims, path: string): Claim | undefined => {
  for (const [ext, owner] of claims.byExt) if (path.endsWith(ext)) return claims.byKind.get(owner)
  return undefined
}
export const fileKind = (claims: Claims, path: string): string | null => claimOf(claims, path)?.kind ?? null
export const bareOf = (claims: Claims, path: string): string => {
  for (const ext of claims.byExt.keys()) if (path.endsWith(ext)) return path.slice(0, -ext.length)
  return path
}
export const stemOf = (claims: Claims, path: string): string => bareOf(claims, path.slice(path.lastIndexOf("/") + 1))
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
