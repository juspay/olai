import { Schema } from "effect"
import type { OutlineFormat } from "./format.ts"
import { basenameOf } from "./paths.ts"

export const ClaimData = Schema.Struct({
  kind: Schema.String, exts: Schema.NonEmptyArray(Schema.String),
  holds: Schema.Literals(["nodes", "text", "bytes"]),
  kept: Schema.Boolean, fetched: Schema.Boolean, noun: Schema.String,
  article: Schema.Literals(["a", "an"]),
  serving: Schema.optionalKey(Schema.Literal("sealed-frame")),
  picture: Schema.optionalKey(Schema.Boolean),
  inert: Schema.optionalKey(Schema.Array(Schema.String)),
  under: Schema.optionalKey(Schema.String),
  elsewhere: Schema.optionalKey(Schema.Boolean),
  opaque: Schema.optionalKey(Schema.Literal(true)),
})
export interface Claim extends Schema.Schema.Type<typeof ClaimData> {
  readonly format?: OutlineFormat
}
export const FileKind = Schema.String

export interface Claims {
  readonly byKind: ReadonlyMap<string, Claim>
  readonly byExt: ReadonlyMap<string, string>
}

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
  for (const [ext, owner] of claims.byExt) {
    if (!path.endsWith(ext)) continue
    const claim = claims.byKind.get(owner)
    if (claim !== undefined && (claim.under === undefined || path.startsWith(claim.under))) return claim
  }
  return undefined
}
export const fileKind = (claims: Claims, path: string): string | null => claimOf(claims, path)?.kind ?? null
export const bareOf = (claims: Claims, path: string): string => withoutExt(claimOf(claims, path), path)
export const stemOf = (claims: Claims, path: string): string =>
  withoutExt(claimOf(claims, path), path.slice(path.lastIndexOf("/") + 1))
const withoutExt = (claim: Claim | undefined, name: string): string => {
  for (const ext of claim?.exts ?? []) if (name.endsWith(ext)) return name.slice(0, -ext.length)
  return name
}
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

export const noClaimFor = (path: string): string => {
  const suffix = /\.[^./]+$/.exec(path)?.[0]
  return suffix === undefined ? "no row claims a path without a suffix" : `no row claims \`${suffix}\``
}
export const unclaimedFileMessage = (path: string): string => `The directory holds nothing by the name ${path}. ${noClaimFor(path).replace(/^n/, "N")}.`
