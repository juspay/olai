import { registerOrRetireServiceWorker } from "@kolu/surface-app/lifecycle"
import { BROWSER_ROWS, bundleRank } from "@olai/bundle"
import { bootstrapBrowser, firstRoster, useBrowserRows, useBootStatus } from "./wire.ts"
import { bootStatus } from "../host/boot-status.ts"
import { attachRenderer } from "../host/runtime.ts"
import { installSharedModules } from "../host/shared.ts"

installSharedModules()
void registerOrRetireServiceWorker()
useBrowserRows(BROWSER_ROWS)
const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")
useBootStatus(bootStatus(root))
await attachRenderer(root, bundleRank)
await firstRoster
await bootstrapBrowser()
