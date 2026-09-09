/** Static configuration protocol. Live readings are owned by the offering row. */
import { customText, isRegular, type Located, type Reading } from "@olai/format"
import { Schema, SchemaAST, type Stream } from "effect"
import { serviceTag } from "@olai/effect-cordis"

export const CONFIGURATION_FILE = "_olai/Settings.olai"
export const configurationFileIn = (paths: Iterable<string>): string | undefined => [...paths]
  .filter((path) => path.split("/").pop()?.toLowerCase() === "settings.olai")
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))[0]

export interface PolicyValue {
  readonly key: string
  readonly value: unknown
  /** flag is transitional until the legacy boot inputs are removed. */
  readonly setBy: "vault" | "default" | "flag"
  readonly says: string
}
export interface PolicyRow {
  readonly config: Readonly<Record<string, unknown>>
  readonly values: ReadonlyArray<PolicyValue>
  readonly on?: boolean
  readonly node?: { readonly file: string; readonly id: string }
}
export interface Configuration {
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
    if (raw !== undefined) {
      try {
        const input = typeof value === "number" ? (raw.trim() === "" ? NaN : Number(raw))
          : typeof value === "boolean" ? (raw === "yes" ? true : raw === "no" ? false : raw) : raw
        value = Schema.decodeUnknownSync(declaration)(input)
        setBy = "vault"
      } catch (error) {
        warn(full, raw, String(error))
      }
    }
    config[key] = value
    values.push({ key: full, value, setBy, says: SchemaAST.resolveDescription(field.type) ?? "" })
  }
  return { config, values }
}


export type EnvironmentReading =
  | { readonly key: string; readonly kind: "secret"; readonly set: boolean; readonly says: string }
  | { readonly key: string; readonly kind: "resource"; readonly set: boolean; readonly says: string; readonly value?: string }

/** Redact before publishing any reading. Secret arms never acquire a value key. */
export const environmentReadings = (
  declarations: ReadonlyArray<{ readonly key: string; readonly secret: boolean; readonly says: string }>,
  vars: Readonly<Record<string, string | undefined>>,
): ReadonlyArray<EnvironmentReading> => declarations.map(({ key, secret, says }) => {
  const value = vars[key]?.trim()
  const set = value !== undefined && value !== ""
  return secret ? { key, kind: "secret", set, says }
    : { key, kind: "resource", set, says, ...(set ? { value } : {}) }
})
