/** Static configuration protocol. Live readings are owned by the offering row. */
import { customText, isRegular, UsageFailure, type WriteRequest, type Located, type Reading } from "@olai/format"
import { Schema, SchemaAST, type Stream } from "effect"
import { serviceTag } from "@olai/effect-cordis"

export const CONFIGURATION_FILE = "_olai/Settings.olai"
export const configurationUnavailable = "Settings can be edited when the configuration reader is running"
export const configurationBroken = (file: string | undefined): string => `Repair ${file ?? CONFIGURATION_FILE} before changing settings`
export const configurationFileIn = (paths: Iterable<string>): string | undefined => [...paths]
  .filter((path) => path.split("/").pop()?.toLowerCase() === "settings.olai")
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0]

export type Control =
  | { readonly kind: "choice"; readonly options: ReadonlyArray<string> }
  | { readonly kind: "switch" }
  | { readonly kind: "number"; readonly integer: boolean; readonly min?: number; readonly max?: number }
  | { readonly kind: "text"; readonly expected?: string }

const checksOf = (ast: SchemaAST.AST): ReadonlyArray<SchemaAST.Check<unknown>> => {
  const flatten = (check: SchemaAST.Check<unknown>): ReadonlyArray<SchemaAST.Check<unknown>> =>
    check._tag === "FilterGroup" ? [check, ...check.checks.flatMap(flatten)] : [check]
  return (ast.checks ?? []).flatMap(flatten)
}

/** Describe the decoded leaf, independent of its string encoding/default. */
export const policyControl = (ast: SchemaAST.AST): Control => {
  const arms = ast._tag === "Union" ? ast.types : [ast]
  if (arms.every(one => one._tag === "Literal" && typeof one.literal === "string"))
    return { kind: "choice", options: arms.map(one => String((one as SchemaAST.Literal).literal)) }
  if (arms.every(one => one._tag === "Boolean")) return { kind: "switch" }
  if (arms.every(one => one._tag === "Number")) {
    const checks = [...checksOf(ast), ...arms.flatMap(checksOf)]
    const bounds: { min?: number; max?: number } = {}
    for (const check of checks) {
      const representation = check.annotations?.representation
      if (representation === undefined) continue
      const payload = representation.payload as { minimum?: number; maximum?: number } | null
      if (["effect/schema/isBetween", "effect/schema/isGreaterThanOrEqualTo"].includes(representation.id) && typeof payload?.minimum === "number")
        bounds.min = Math.max(bounds.min ?? -Infinity, payload.minimum)
      if (["effect/schema/isBetween", "effect/schema/isLessThanOrEqualTo"].includes(representation.id) && typeof payload?.maximum === "number")
        bounds.max = Math.min(bounds.max ?? Infinity, payload.maximum)
    }
    return { kind: "number", integer: arms.every(one => checksOf(one).some(check => check.annotations?.representation?.id === "effect/schema/isInt")) || checksOf(ast).some(check => check.annotations?.representation?.id === "effect/schema/isInt"), ...bounds }
  }
  const expected = checksOf(ast).map(check => check.annotations?.expected).filter((one): one is string => typeof one === "string").join("; ")
  return { kind: "text", ...(expected === "" ? {} : { expected }) }
}

/** Both file reading and panel writes use the leaf's own decoder. */
export const coerceLeaf = (schema: Schema.ConstraintDecoder<unknown, never>, raw: string): unknown => {
  const control = policyControl(schema.ast)
  const input = control.kind === "number" ? (raw.trim() === "" ? NaN : Number(raw))
    : control.kind === "switch" ? (raw === "yes" ? true : raw === "no" ? false : raw) : raw
  const decode = Schema.decodeUnknownSync(schema)
  if (input === raw) return decode(raw)
  // Some declarations already own a string-to-value codec. Give that encoding
  // its ordinary input before adapting a bare number or boolean schema.
  try { return decode(raw) } catch { return decode(input) }
}

export interface PolicyValue {
  readonly key: string
  readonly value: unknown
  readonly setBy: "vault" | "default"
  readonly says: string
  readonly control: Control
  readonly problem?: { readonly raw: string; readonly why: string }
}
export interface PolicyRow {
  readonly config: Readonly<Record<string, unknown>>
  readonly values: ReadonlyArray<PolicyValue>
  readonly on?: boolean
  readonly node?: { readonly file: string; readonly id: string }
}
export interface Configuration {
  readonly nodes?: ReadonlyArray<Located>
  readonly revision: number
  readonly file?: string
  readonly broken?: string
  readonly rows: ReadonlyMap<string, PolicyRow>
}
export interface ConfigurationSource {
  readonly changes: Stream.Stream<Configuration>
  readonly current: () => Configuration
}
export const ConfigurationSource = serviceTag<ConfigurationSource>("configuration")

/** The shared namespace walk, over the vault codec's already-decoded revision. */
export const configurationNodes = (reading: Pick<Reading, "set" | "derived">) => {
  const file = configurationFileIn(reading.set.documents.map((doc) => doc.path))
  const broken = file === undefined ? undefined : reading.set.broken.find((one) => one.file === file)
  const nodes = file === undefined || broken !== undefined ? [] : reading.derived.nodes.filter(isRegular).filter((one) => one.file === file)
  return { file, broken, nodes }
}

export const configurationNode = (nodes: ReadonlyArray<Located>, name: string) =>
  nodes.filter(isRegular).find(({ node }) => node.parent === undefined && node.title === name)

/** Decode each leaf independently, preserving valid siblings when one is bad.
 * Numeric/boolean properties are text in an outline; the schema's default
 * supplies their representation. The schema remains the validity check. */
export const decodePolicy = (
  schema: Schema.ConstraintDecoder<unknown, never>,
  nodes: ReadonlyArray<Located>,
  node: Located | undefined,
  warn: (key: string, value: string, why: string) => void,
  prefix = "",
): { config: Record<string, unknown>; values: PolicyValue[] } => {
  const defaults = Schema.decodeUnknownSync(schema)({}) as Record<string, unknown>
  if (schema.ast._tag !== "Objects") throw new Error("a policy declaration must be a struct")
  const config: Record<string, unknown> = {}
  const values: PolicyValue[] = []
  for (const field of schema.ast.propertySignatures) {
    const key = String(field.name)
    const full = prefix + key
    const declaration = Schema.make(field.type) as Schema.ConstraintDecoder<unknown, never>
    if (field.type._tag === "Objects") {
      const child = node === undefined ? undefined : nodes.filter(isRegular).find((one) => one.node.parent === node.node.id && one.node.title === key)
      const nested = decodePolicy(declaration, nodes, child, warn, full + ".")
      config[key] = nested.config
      values.push(...nested.values)
      continue
    }
    const raw = node !== undefined && isRegular(node) ? customText(node.node, key) : undefined
    let value = defaults[key]
    let setBy: "vault" | "default" = "default"
    let problem: PolicyValue["problem"]
    if (raw !== undefined) {
      try {
        value = coerceLeaf(declaration, raw)
        setBy = "vault"
      } catch (error) {
        problem = { raw, why: (error instanceof Error ? error.message : String(error)) }
        warn(full, raw, problem.why)
      }
    }
    config[key] = value
    values.push({ key: full, value, setBy, says: SchemaAST.resolveDescription(field.type) ?? "", control: policyControl(field.type), ...(problem === undefined ? {} : { problem }) })
  }
  return { config, values }
}


export type EnvironmentReading =
  | { readonly key: string; readonly kind: "secret"; readonly set: boolean; readonly says: string }
  | { readonly key: string; readonly kind: "resource"; readonly set: boolean; readonly says: string; readonly value?: string; readonly source?: "wrapper" }

/** Redact before publishing any reading. Secret arms never acquire a value key. */
export const environmentReadings = (
  declarations: ReadonlyArray<{ readonly key: string; readonly secret: boolean; readonly says: string }>,
  vars: Readonly<Record<string, string | undefined>>,
): ReadonlyArray<EnvironmentReading> => declarations.map(({ key, secret, says }) => {
  const value = vars[key]?.trim()
  const set = value !== undefined && value !== ""
  return secret ? { key, kind: "secret", set, says }
    : { key, kind: "resource", set, says, ...(set ? { value: publicResource(value) } : {}), ...(vars.OLAI_WRAPPER_DEFAULTS?.split(",").includes(key) ? { source: "wrapper" as const } : {}) }
})

/** URL userinfo is credential material even on an otherwise public resource. */
const publicResource = (value: string): string => {
  try {
    const url = new URL(value)
    if (url.username === "" && url.password === "") return value
    url.username = ""
    url.password = ""
    return url.toString()
  }
  catch { return value }
}


/** Resolve a declared leaf and build one ordinary write. Missing ancestors are
 * captured together, so validation cannot leave an empty section behind. */
export const policyEdit = (
  schema: Schema.ConstraintDecoder<unknown, never> | undefined,
  nodes: ReadonlyArray<Located>, node: Located | undefined,
  file: string | undefined, name: string, key: string, value: string | null,
): WriteRequest | undefined => {
  const parts = key.split(".")
  let ast = schema?.ast
  for (const part of parts) {
    ast = ast?._tag === "Objects" ? ast.propertySignatures.find(field => field.name === part)?.type : undefined
  }
  if (ast === undefined || ast._tag === "Objects")
    throw new UsageFailure({ reason: `No editable setting "${key}" is declared by "${name}".` })
  if (value !== null) {
    try { coerceLeaf(Schema.make(ast) as Schema.ConstraintDecoder<unknown, never>, value) }
    catch (error) { throw new UsageFailure({ reason: (error instanceof Error ? error.message : String(error)) }) }
  }
  const leaf = parts.pop()!
  type Seed = { title: string; props?: Record<string, string>; children?: ReadonlyArray<Seed> }
  const seed = (titles: ReadonlyArray<string>): Seed => ({ title: titles[0]!,
    ...(titles.length === 1 ? { props: { [leaf]: value! } } : { children: [seed(titles.slice(1))] }),
  })
  if (node === undefined) {
    if (value === null) return undefined
    const tree = seed([name, ...parts])
    return file === undefined ? { op: "create", file: CONFIGURATION_FILE, seed: tree } : { op: "add", file, ...tree }
  }
  let at = node
  for (let index = 0; index < parts.length; index++) {
    const child = nodes.filter(isRegular).find(one => one.node.parent === at.node.id && one.node.title === parts[index])
    if (child === undefined) return value === null ? undefined : { op: "add", parent: at.node.id, ...seed(parts.slice(index)) }
    at = child
  }
  return { op: "prop", id: at.node.id, key: leaf, value }
}
