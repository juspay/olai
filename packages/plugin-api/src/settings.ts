/**
 * A PLUGIN'S SETTINGS SECTION — the schema it registers, the document the
 * vault holds, and the page view the panel draws.
 *
 * Core renders from this description. A plugin that wants its own face
 * hangs it in `plugins.row.settings`; everything here is data, and none of
 * it spells a plugin's name.
 *
 * A secret does not belong here. `_olai/Settings.olai` is committed
 * plaintext; a field marked `secret` is refused at register. Host facts
 * stay on the row's `config:` in `olai.yml`, and secrets stay in `Env`.
 */

import { Schema } from "effect"

import type { Refusal } from "./contract.ts"

export type SettingsApplies = "live" | "restart"
export type SettingsKind = "string" | "number" | "boolean" | "choice"

export interface FieldSpec {
  readonly key: string
  readonly kind: SettingsKind
  readonly choices?: ReadonlyArray<string>
}

export interface SettingsOptions<T> {
  readonly validate?: (value: T) => string | null
  readonly applies?: Readonly<Record<string, SettingsApplies>>
  /** When the schema uses `optionalKey` and decode-of-`{}` is empty. */
  readonly defaults?: T
}

/** One plugin's overlay in `_olai/Settings.olai` — keys to string values. */
export type SettingsDocument = Readonly<Record<string, Readonly<Record<string, string>>>>

export const usage = (reason: string): Refusal =>
  ({ _tag: "UsageFailure", reason }) as Refusal

type Ast = {
  readonly _tag: string
  readonly to?: Ast
  readonly from?: Ast
  readonly propertySignatures?: ReadonlyArray<PropertyAst>
  readonly types?: ReadonlyArray<Ast>
  readonly literal?: unknown
  readonly annotations?: Readonly<Record<PropertyKey, unknown>>
}

type PropertyAst = {
  readonly name: PropertyKey
  readonly type: Ast
  readonly isOptional?: boolean
  readonly annotations?: Readonly<Record<PropertyKey, unknown>>
}

const astOf = (schema: Schema.Schema<unknown>): Ast =>
  (schema as unknown as { readonly ast: Ast }).ast

const unwrap = (ast: Ast): Ast => {
  if ((ast._tag === "Transformation" || ast._tag === "Refinement") && ast.to !== undefined) {
    return unwrap(ast.to)
  }
  if (ast._tag === "Suspend" && ast.from !== undefined) return unwrap(ast.from)
  return ast
}

const annotatedSecret = (annotations: Readonly<Record<PropertyKey, unknown>> | undefined): boolean =>
  annotations !== undefined && Boolean(annotations["secret"])

const classify = (ast: Ast): { readonly kind: SettingsKind; readonly choices?: ReadonlyArray<string> } => {
  const inner = unwrap(ast)
  if (inner._tag === "Number" || inner._tag === "NumberKeyword") return { kind: "number" }
  if (inner._tag === "Boolean" || inner._tag === "BooleanKeyword") return { kind: "boolean" }
  if (inner._tag === "Literal" && typeof inner.literal === "string") {
    return { kind: "choice", choices: [inner.literal] }
  }
  if (inner._tag === "Union" && inner.types !== undefined) {
    const literals = inner.types.flatMap((one) => {
      const leaf = unwrap(one)
      return leaf._tag === "Literal" && typeof leaf.literal === "string" ? [leaf.literal] : []
    })
    if (literals.length > 0 && literals.length === inner.types.length) {
      return { kind: "choice", choices: literals }
    }
  }
  return { kind: "string" }
}

const typeLiteral = (ast: Ast): Ast | null => {
  const inner = unwrap(ast)
  // Schema 4 names a struct `Objects`; older ASTs said `TypeLiteral`.
  if (inner._tag === "Objects" || inner._tag === "TypeLiteral") return inner
  if (inner.from !== undefined) return typeLiteral(inner.from)
  if (inner.to !== undefined) return typeLiteral(inner.to)
  return null
}

const propertiesOf = (schema: Schema.Schema<unknown>): ReadonlyArray<PropertyAst> => {
  const literal = typeLiteral(astOf(schema))
  return literal?.propertySignatures ?? []
}

/** The fields a schema describes, in declaration order. */
export const fieldsOf = (schema: Schema.Schema<unknown>): ReadonlyArray<FieldSpec> => {
  const fields: Array<FieldSpec> = []
  for (const property of propertiesOf(schema)) {
    if (typeof property.name !== "string") continue
    const { kind, choices } = classify(property.type)
    fields.push({
      key: property.name,
      kind,
      ...(choices === undefined ? {} : { choices }),
    })
  }
  return fields
}

/** Keys annotated `secret: true` — register dies naming them. */
export const secretKeysOf = (schema: Schema.Schema<unknown>): ReadonlyArray<string> => {
  const keys: Array<string> = []
  for (const property of propertiesOf(schema)) {
    if (typeof property.name !== "string") continue
    if (
      annotatedSecret(property.annotations)
      || annotatedSecret(property.type.annotations)
      || annotatedSecret(unwrap(property.type).annotations)
    ) keys.push(property.name)
  }
  return keys
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? { ...value as Record<string, unknown> }
    : {}

export const tryDecode = (
  schema: Schema.Schema<unknown>,
  value: unknown,
): Record<string, unknown> | null => {
  try {
    const decode = Schema.decodeUnknownSync as (
      schema: Schema.Schema<unknown>,
    ) => (value: unknown) => unknown
    return asRecord(decode(schema)(value))
  } catch {
    return null
  }
}

/** Decode-of-`{}`, or the explicit map a schema with `optionalKey` needs. */
export const defaultsOf = (
  schema: Schema.Schema<unknown>,
  explicit: Record<string, unknown> | undefined,
): Record<string, unknown> =>
  explicit ?? tryDecode(schema, {}) ?? {}

export const stringify = (value: unknown): string => {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return JSON.stringify(value) ?? ""
}

export const parseField = (kind: SettingsKind, raw: string): unknown => {
  if (kind === "number") {
    const n = Number(raw)
    return Number.isFinite(n) ? n : raw
  }
  if (kind === "boolean") return raw === "true" || raw === "1"
  return raw
}

export interface Judged {
  readonly value: Record<string, unknown>
  readonly faults: Readonly<Record<string, string>>
}

/**
 * SCHEMA DEFAULTS, THEN THE VAULT'S EDITS.
 *
 * Host facts stay on the row, drawn read-only beside this section — they
 * are not a layer here. A key the schema (or the plugin's `validate`)
 * cannot judge is dropped: a typo in `_olai/Settings.olai` must not
 * become a field the plugin then observes. Keys that decode alone are
 * kept; the rest are named on the page.
 */
export const resolve = (
  schema: Schema.Schema<unknown>,
  defaults: Record<string, unknown>,
  overlay: Readonly<Record<string, string>> | undefined,
  fields: ReadonlyArray<FieldSpec>,
  validate?: (value: Record<string, unknown>) => string | null,
): Judged => {
  const fromVault: Record<string, unknown> = {}
  const faults: Record<string, string> = {}
  if (overlay !== undefined) {
    const byKey = new Map(fields.map((one) => [one.key, one] as const))
    for (const [key, raw] of Object.entries(overlay)) {
      const field = byKey.get(key)
      if (field === undefined) continue
      const parsed = parseField(field.kind, raw)
      const candidate = { ...defaults, [key]: parsed }
      const decoded = tryDecode(schema, candidate)
      if (decoded === null || (validate?.(decoded) ?? null) !== null) {
        faults[key] = `\`${key}\` in _olai/Settings.olai is not a value this field accepts`
        continue
      }
      fromVault[key] = parsed
    }
  }
  const merged = { ...defaults, ...fromVault }
  return { value: tryDecode(schema, merged) ?? merged, faults }
}

export interface PageField {
  readonly key: string
  readonly kind: SettingsKind
  readonly choices?: ReadonlyArray<string>
  readonly pending: boolean
  readonly value?: unknown
  readonly fault?: string
}

export const pageFields = (
  fields: ReadonlyArray<FieldSpec>,
  resolved: Record<string, unknown>,
  running: Record<string, unknown>,
  applies: Readonly<Record<string, SettingsApplies>>,
  faults: Readonly<Record<string, string>> = {},
): ReadonlyArray<PageField> =>
  fields.map((field) => {
    const appliesAs = applies[field.key] ?? "live"
    const value = resolved[field.key]
    const held = running[field.key]
    const pending = appliesAs === "restart" && stringify(value) !== stringify(held)
    const fault = faults[field.key]
    return {
      key: field.key,
      kind: field.kind,
      ...(field.choices === undefined ? {} : { choices: field.choices }),
      pending,
      ...(value === undefined ? {} : { value }),
      ...(fault === undefined ? {} : { fault }),
    }
  })
