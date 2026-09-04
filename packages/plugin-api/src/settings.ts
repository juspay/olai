/**
 * A PLUGIN'S SETTINGS SECTION — the schema it registers, the document the
 * vault holds, and the page view with secrets stripped.
 *
 * Core renders from this description. A plugin that wants its own face
 * hangs it in `plugins.row.settings`; everything here is data, and none of
 * it spells a plugin's name.
 */

import { Schema } from "effect"

import type { Refusal } from "./contract.ts"

/** A field whose value must never reach a page. */
export const SECRET = Symbol.for("@olai/settings/secret")

/** Mark a schema field secret — the page learns that it is set, never what. */
export const secret = <A, I, R>(schema: Schema.Schema<A, I, R>): Schema.Schema<A, I, R> =>
  schema.annotate({ [SECRET]: true })

export type SettingsApplies = "live" | "restart"
export type SettingsKind = "string" | "number" | "boolean" | "choice"
export type SettingsSource = "default" | "row" | "vault"

export interface FieldSpec {
  readonly key: string
  readonly kind: SettingsKind
  readonly choices?: ReadonlyArray<string>
  readonly secret: boolean
}

export interface SettingsOptions<T> {
  readonly validate?: (value: T) => string | null
  readonly applies?: Readonly<Record<string, SettingsApplies>>
  readonly secret?: ReadonlyArray<string>
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
  annotations !== undefined && Boolean(annotations[SECRET] ?? annotations["secret"])

const classify = (ast: Ast): { readonly kind: SettingsKind; readonly choices?: ReadonlyArray<string> } => {
  const inner = unwrap(ast)
  if (inner._tag === "NumberKeyword") return { kind: "number" }
  if (inner._tag === "BooleanKeyword") return { kind: "boolean" }
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
  if (inner._tag === "TypeLiteral") return inner
  if (inner.from !== undefined) return typeLiteral(inner.from)
  if (inner.to !== undefined) return typeLiteral(inner.to)
  return null
}

/** The fields a schema describes, in declaration order. */
export const fieldsOf = (schema: Schema.Schema<unknown>): ReadonlyArray<FieldSpec> => {
  const literal = typeLiteral(astOf(schema))
  if (literal?.propertySignatures === undefined) return []
  const fields: Array<FieldSpec> = []
  for (const property of literal.propertySignatures) {
    if (typeof property.name !== "string") continue
    const { kind, choices } = classify(property.type)
    fields.push({
      key: property.name,
      kind,
      ...(choices === undefined ? {} : { choices }),
      secret: annotatedSecret(property.annotations) || annotatedSecret(property.type.annotations)
        || annotatedSecret(unwrap(property.type).annotations),
    })
  }
  return fields
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

/**
 * SCHEMA DEFAULTS, THEN THE ROW'S CONFIG, THEN THE VAULT'S EDITS.
 *
 * A key the schema cannot judge is dropped rather than stored: the overlay
 * is the person's, and a typo in `_olai/Settings.olai` must not become a
 * field the plugin then observes.
 */
export const resolve = (
  schema: Schema.Schema<unknown>,
  defaults: Record<string, unknown>,
  base: Record<string, unknown>,
  overlay: Readonly<Record<string, string>> | undefined,
  fields: ReadonlyArray<FieldSpec>,
): Record<string, unknown> => {
  const fromVault: Record<string, unknown> = {}
  if (overlay !== undefined) {
    const byKey = new Map(fields.map((one) => [one.key, one] as const))
    for (const [key, raw] of Object.entries(overlay)) {
      const field = byKey.get(key)
      if (field === undefined) continue
      fromVault[key] = parseField(field.kind, raw)
    }
  }
  const merged = { ...defaults, ...base, ...fromVault }
  return tryDecode(schema, merged) ?? merged
}

export const sourceOf = (
  key: string,
  overlay: Readonly<Record<string, string>> | undefined,
  base: Record<string, unknown>,
): SettingsSource => {
  if (overlay !== undefined && overlay[key] !== undefined) return "vault"
  if (Object.prototype.hasOwnProperty.call(base, key)) return "row"
  return "default"
}

export interface PageField {
  readonly key: string
  readonly kind: SettingsKind
  readonly choices?: ReadonlyArray<string>
  readonly secret: boolean
  readonly applies: SettingsApplies
  readonly pending: boolean
  readonly source: SettingsSource
  readonly set: boolean
  readonly value?: unknown
}

export const pageFields = (
  fields: ReadonlyArray<FieldSpec>,
  resolved: Record<string, unknown>,
  running: Record<string, unknown>,
  overlay: Readonly<Record<string, string>> | undefined,
  base: Record<string, unknown>,
  applies: Readonly<Record<string, SettingsApplies>>,
  secrets: ReadonlySet<string>,
): ReadonlyArray<PageField> =>
  fields.map((field) => {
    const secretField = field.secret || secrets.has(field.key)
    const appliesAs = applies[field.key] ?? "live"
    const value = resolved[field.key]
    const held = running[field.key]
    const pending = appliesAs === "restart" && stringify(value) !== stringify(held)
    const source = sourceOf(field.key, overlay, base)
    const set = value !== undefined && value !== ""
    return {
      key: field.key,
      kind: field.kind,
      ...(field.choices === undefined ? {} : { choices: field.choices }),
      secret: secretField,
      applies: appliesAs,
      pending,
      source,
      set,
      ...(secretField ? {} : { value }),
    }
  })
