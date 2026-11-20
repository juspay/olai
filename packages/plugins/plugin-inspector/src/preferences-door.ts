import { heldService } from "@olai/ui-primitives/held.ts"
import type { PreferencesPanel } from "olai-plugin-preferences/contract"

const provider = heldService<PreferencesPanel>()

export const holdPreferencesPanel = provider.hold

export const preferencesPanel = provider.read
