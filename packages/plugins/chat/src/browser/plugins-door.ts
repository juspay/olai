import { heldService } from "@olai/ui-primitives/held.ts"
import type { ConfigurationPanel } from "olai-plugin-plugin-inspector/contract"

const provider = heldService<ConfigurationPanel>()

export const holdPluginsDoor = provider.hold

export const pluginsDoor = provider.read
