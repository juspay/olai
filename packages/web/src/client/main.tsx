/** Permanent browser host: discover bundle rows, attach the mount capability
 * and coordinate the selected plugin graph. Feature state and observers are
 * acquired by their owning browser plugins. */
import { registerOrRetireServiceWorker } from "@kolu/surface-app/lifecycle"
import { BROWSER_ROWS, bundleRank } from "@olai/bundle"
import { bootstrapBrowser, firstRoster, useBrowserRows, useBootStatus } from "./wire.ts"
import { bootStatus } from "./plugins/boot-status.ts"
import { attachRenderer, useBundleOrder } from "./plugins/runtime.ts"
// Dynamic modules reuse the host's shared runtime identities.
import "./plugins/shared.ts"

void registerOrRetireServiceWorker()
useBrowserRows(BROWSER_ROWS)
useBundleOrder(bundleRank)
const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")
useBootStatus(bootStatus(root))
await attachRenderer(root)
await firstRoster
await bootstrapBrowser()
