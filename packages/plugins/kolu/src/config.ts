/** The live watch reads its own namespace from the same decoded revision.
 * Malformed-value warnings belong to the shared reader, never a second log. */
import { isRegular, type Located } from "@olai/format"
import { configurationNode, decodePolicy } from "@olai/plugin-api/configuration"
import { DEFAULT_WATCH, type WatchConfig } from "olai-plugin-kolu/appliance"
import { Config, configuredWatch } from "./settings.ts"
import { name } from "./wire.ts"

export interface WatchReading {
  readonly config: WatchConfig
  readonly malformed: ReadonlyArray<string>
  readonly node?: string
}
export const watchConfigIn = (nodes: ReadonlyArray<Located>, file: string | null): WatchReading => {
  if (file === null) return { config: DEFAULT_WATCH, malformed: [] }
  const inside = nodes.filter(isRegular).filter((one) => one.file === file)
  const node = configurationNode(inside, name)
  if (node === undefined) return { config: DEFAULT_WATCH, malformed: [] }
  const parsed = decodePolicy(Config, inside, node, () => {})
  return { config: configuredWatch(parsed.config as typeof Config.Type), malformed: [], node: node.node.id }
}
