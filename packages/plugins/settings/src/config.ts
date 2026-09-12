/** The only settings reader: one vault revision, all row namespaces. */
import { customText, type Reading } from "@olai/format"
import { configurationNodes, configurationNode, decodePolicy, type Configuration, type PolicyRow } from "@olai/plugin-api/configuration"
import type { Schema } from "effect"

export type Declarations = ReadonlyMap<string, Schema.ConstraintDecoder<unknown, never> | undefined>
export const readConfiguration = (reading: Pick<Reading, "set" | "derived">, declarations: Declarations, revision: number, warn: (line: string) => void): Configuration => {
  const { file, broken, nodes } = configurationNodes(reading)
  if (broken !== undefined) warn(`${file}: malformed settings file; every row uses its defaults`)
  const rows = new Map<string, PolicyRow>()
  for (const [name, schema] of declarations) {
    const node = configurationNode(nodes, name)
    let parsed: ReturnType<typeof decodePolicy>
    try { parsed = schema === undefined ? { config: {}, values: [] } : decodePolicy(schema, nodes, node,
      (key, value, why) => warn(`${file}: ${name}.${key}: ${JSON.stringify(value)} uses its default — ${why}`)) }
    catch (error) { warn(`${file ?? "built declaration"}: ${name}: invalid Config — ${(error instanceof Error ? error.message : String(error))}`); parsed = { config: {}, values: [] } }
    const raw = node === undefined ? undefined : customText(node.node, "on")
    const on = raw === "yes" ? true : raw === "no" ? false : undefined
    if (raw !== undefined && on === undefined) warn(`${file}: ${name}.on: ${JSON.stringify(raw)} uses its default — expected yes or no`)
    rows.set(name, { ...parsed, ...(on === undefined ? {} : { on }), ...(node === undefined ? {} : { node: { file: node.file, id: node.node.id } }) })
  }
  return { revision, rows, nodes, ...(file === undefined ? {} : { file }), ...(broken === undefined ? {} : { broken: `${file}: malformed settings file` }) }
}

/** One warning per malformed shape for this reader's activation. */
export const warningsOnce = (say: (line: string) => void) => {
  const seen = new Set<string>()
  return (line: string) => { if (!seen.has(line)) { seen.add(line); say(line) } }
}
