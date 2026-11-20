import type { BrowserManagement } from "@olai/surface/management"
import { heldService } from "@olai/ui-primitives/held.ts"

type Changing = Pick<BrowserManagement, "changing">

const provider = heldService<Changing>()

export const holdPluginRoster = provider.hold

export const pluginsChanging = (): boolean => provider.read()?.changing() ?? false
