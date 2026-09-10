/** The process namespace is read from the same published file revision as rows.
 * Bootstrap addresses and credentials are readings, never persisted policy. */
import { configurationNode, decodePolicy, type Configuration, type PolicyValue } from "@olai/plugin-api/configuration"
import { Effect, Schema } from "effect"
export const Config = Schema.Struct({
  "log-format": Schema.Literals(["auto", "logfmt", "pretty"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("auto" as const)),
    Schema.annotate({ description: "log presentation; auto follows the destination terminal" })),
  "log-level": Schema.Literals(["debug", "info", "warn", "error"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("info" as const)),
    Schema.annotate({ description: "the minimum severity this serve logs" })),
})
export const processPolicy = (publication: Configuration | undefined, warn: (line: string) => void): { config: typeof Config.Type; values: ReadonlyArray<PolicyValue>; node?: { file: string; id: string } } => {
  const nodes = publication?.nodes ?? []
  const node = configurationNode(nodes, "olai")
  const parsed = decodePolicy(Config, nodes, node, (key, value, reason) => warn(`${publication?.file}: olai.${key}: ${JSON.stringify(value)} uses its default — ${reason}`))
  return { config: parsed.config as typeof Config.Type, values: parsed.values, ...(node === undefined ? {} : { node: { file: node.file, id: node.node.id } }) }
}
