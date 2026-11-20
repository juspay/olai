import { heldService } from "@olai/ui-primitives/held.ts"
import type { Shell } from "olai-plugin-layout/contract"

const provider = heldService<Shell>()

export const holdShell = provider.hold

export const setSidebarOpen = (open: boolean): void => provider.read()?.setSidebarOpen(open)

export const revealSidebar = (): void => provider.read()?.revealSidebar()
