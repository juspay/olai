import { heldService } from "@olai/ui-primitives/held.ts"
import type { ConfigurationPanel } from "olai-plugin-plugin-inspector/contract"
const provider = heldService<ConfigurationPanel>()
export const holdConfigurationPanel = provider.hold
export const configurationPanel = provider.read
