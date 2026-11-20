import { Schema } from "effect"

import { pathedOf } from "./documents.ts"
import { dayOf } from "./occasion.ts"
import { isIsoInstant } from "./parse.ts"
import {
  basedAt,
  type Declared,
  declaredFor,
  type KindVocabulary,
  type PropDeclarations,
  resolvedDoc,
} from "./typing.ts"

export const Meaning = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("document"), file: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("node"),
    id: Schema.String,
    titled: Schema.Boolean,
  }),
  Schema.Struct({ kind: Schema.Literal("day"), date: Schema.String }),
  Schema.Struct({ kind: Schema.Literal("away"), href: Schema.String }),
])
export type Meaning = typeof Meaning.Type

/**
 * `prop` AND NOT `key`: the page stream declares `arrayKey: "key"`
 * (juspay/kolu#2190), so a field of that name would make the merge treat this
 * as a KEYED array and identify two doors on two rows by the property they
 * happen to share.
 */
export const Door = Schema.Struct({
  from: Schema.String,
  prop: Schema.String,
  value: Schema.String,
  opens: Meaning,
})
export type Door = typeof Door.Type

/**
 * `prop` and not `key`, for {@link Door}'s wire reason exactly: a field of that
 * name would make the page stream's merge treat this as a KEYED array.
 */
export const Licence = Schema.Struct({
  from: Schema.String,
  prop: Schema.String,
  value: Schema.String,
  word: Schema.String,
})
export type Licence = typeof Licence.Type

export interface Vault {
  readonly declarations: PropDeclarations
  readonly kinds: KindVocabulary
  readonly declares: (id: string) => boolean
  readonly serves: (file: string) => boolean
  readonly documents: (file: string) => boolean
}

export interface Consulted {
  readonly opens: Meaning | null
  readonly word: string | null
}

const opening = (opens: Meaning | null): Consulted => ({ opens, word: null })

const NOTHING: Consulted = { opens: null, word: null }

export const meaningOf = (
  vault: Vault,
  from: string,
  key: string,
  value: string,
): Meaning | null => consult(vault, from, key, value).opens

export const consult = (
  vault: Vault,
  from: string,
  key: string,
  value: string,
): Consulted => {
  if (value === "") return NOTHING
  const declared = declaredFor(vault.declarations, key)
  if (declared === undefined || declared.type.kind === "text") {
    return opening(guessed(vault, from, value))
  }
  return declaredly(vault, declared, from, value)
}

const declaredly = (
  vault: Vault,
  declared: Declared,
  from: string,
  value: string,
): Consulted => {
  switch (declared.type.kind) {
    case "text":
      return opening(guessed(vault, from, value))
    case "date":
      return opening(dayIn(value))
    case "int":
      return NOTHING
    case "ref":
    case "node":
      return opening(vault.declares(value) ? { kind: "node", id: value, titled: true } : null)
    case "doc": {
      const file = resolvedDoc(declared, from, value)
      return file !== undefined && vault.documents(file) ? opening({ kind: "document", file }) : NOTHING
    }
    case "path":
      return opening(servedFrom(vault, declared, from, value))
    case "contributed":
      const claiming = vault.kinds.enabled.get(declared.type.word)
      if (claiming === undefined) return opening(guessed(vault, from, value))
      return claiming.admits(value) ? { opens: null, word: declared.type.word } : NOTHING
  }
}

/**
 * THE UNDECLARED ARM: the five shape guesses, in the order they are read — a
 * URL, a date, a node id, a vault path, a GitHub reference. The date is read
 * before the id match, though a date is id-shaped.
 */
const guessed = (vault: Vault, from: string, value: string): Meaning | null => {
  if (isHttp(value)) return { kind: "away", href: value }
  const day = dayIn(value)
  if (day !== null) return day
  if (vault.declares(value)) return { kind: "node", id: value, titled: false }
  const served = servedFrom(vault, undefined, from, value)
  if (served !== null) return served
  const github = GITHUB_REF.exec(value)
  if (github !== null) {
    const [, owner, repo, number] = github as unknown as [string, string, string, string]
    return { kind: "away", href: `https://github.com/${owner}/${repo}/issues/${number}` }
  }
  return null
}

const dayIn = (value: string): Meaning | null =>
  isIsoInstant(value) ? { kind: "day", date: dayOf(value) } : null

const servedFrom = (
  vault: Vault,
  declared: Declared | undefined,
  from: string,
  value: string,
): Meaning | null => {
  const file = pathedOf(basedAt(declared, from), value)
  return file !== null && vault.serves(file) ? { kind: "document", file } : null
}

const isHttp = (value: string): boolean =>
  value.startsWith("https://") || value.startsWith("http://")

const GITHUB_REF = /^([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+)#(\d+)$/
