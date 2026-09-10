/** The live watch reads its own namespace from the same decoded revision.
 * Malformed-value warnings belong to the shared reader, never a second log. */
import { isRegular, type Located, type Reading } from "@olai/format"
import { configurationNode, configurationNodes, decodePolicy } from "@olai/plugin-api/configuration"
import { DEFAULT_WATCH, type WatchConfig } from "olai-plugin-kolu/appliance"
import { Config, configuredWatch } from "./settings.ts"
import { name } from "./wire.ts"

export interface WatchReading {
  readonly config: WatchConfig
}
export const watchConfigIn = (nodes: ReadonlyArray<Located>, file: string | null): WatchReading => {
  if (file === null) return { config: DEFAULT_WATCH }
  const inside = nodes.filter(isRegular).filter((one) => one.file === file)
  const node = configurationNode(inside, name)
  if (node === undefined) return { config: DEFAULT_WATCH }
  const parsed = decodePolicy(Config, inside, node, () => {})
  return { config: configuredWatch(parsed.config as typeof Config.Type) }
}

/** Live policy uses the same broken-file gate as the shared reader. */
export const watchReadingIn = (reading: Pick<Reading, "set" | "derived">): WatchReading => {
  const { nodes, file } = configurationNodes(reading)
  return watchConfigIn(nodes, file ?? null)
}
