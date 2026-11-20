import { workspaceRoutingOver } from "./workspace.ts"
import type { Directory } from "olai-plugin-vault/file-state"
import type { Claims } from "@olai/format"
import { heldService } from "@olai/ui-primitives/held.ts"

import { type MountedPages, NO_PAGES, routingOver } from "./routes.ts"

const files = heldService<Pick<Directory, "claims" | "paths" | "standing">>()
export const holdFiles = files.hold
export const directory = files.read
export const fileClaims = () => files.read()?.claims()
const table = heldService<() => MountedPages>()

export const holdRoutePages = table.hold

export const routePages = (): MountedPages => table.read()?.() ?? NO_PAGES

export const routing = workspaceRoutingOver(routingOver(fileClaims, routePages))
