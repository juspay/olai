/**
 * The client entry point. It renders; everything else is a module away.
 */

import { registerOrRetireServiceWorker } from "@kolu/surface-app/lifecycle"


import { protectComposition } from "./composition.ts"
import { followFolders } from "./fold/folders.ts"
import { followFolds } from "./fold/memory.ts"
import { followName } from "./named.ts"
import { followKeys } from "./quiescence.ts"
import { runAsync } from "./run.ts"
import { followAlerts } from "./settings/alerts.ts"
import { followDensity } from "./settings/density.ts"
import { followDonePrefs } from "./settings/done.ts"
import { provideFurniture } from "./plugins/furniture.tsx"
import { bootstrapBrowser, connectionReadout, firstRoster, olai, useBrowserRows, useBootStatus } from "./wire.ts"
import { bootStatus } from "./plugins/boot-status.ts"
import { attachRenderer, useBundleOrder } from "./plugins/runtime.ts"
// FOR ITS SIDE EFFECT, and above the first render: this app's Solid, Effect and
// plugin interface, put where a plugin the SERVE compiled out of somebody's
// vault can reach them (`./plugins/shared.ts` argues why a second copy of any of
// the three is the app swallowing itself).
import "./plugins/shared.ts"
// THE ONE PLACE IN THIS PACKAGE THAT MAY NAME THE REGISTRY.
//
// `@olai/bundle` names every plugin, and a plugin's browser half imports this
// app — a face that draws inside it draws with its furniture — so an app module
// that imported the registry back would put every plugin on every other
// plugin's graph. `packages/bundle/src/fence.test.ts` says so in the claim that
// derives each tenant's own member set.
//
// This file is the ENTRY. Nothing imports it, so the arrow stops here: it reads
// the rows and the order and TELLS the two modules that spend them, before it
// awaits the first roster.
import { BROWSER_ROWS, bundleRank } from "@olai/bundle"

// The paired half of the `/sw.js` the server serves, which is now the
// framework's NOTIFICATION worker (packages/server/src/listener.ts says why):
// registering it is what makes `registration.showNotification` reachable, and
// that is the only notification path an installed PWA has at all
// (`./notify.ts`). It is still not a caching worker — it
// registers no `fetch` handler, so "live or nothing" is untouched — and on
// activate it purges whatever an older olai left and reloads the tabs that
// worker was controlling, which is the self-healing this call used to be
// entirely about. Where no worker can be registered (a dev server that does
// not serve one), the framework RETIRES instead, so the origin is never left
// with a legacy caching worker and no banner.
void registerOrRetireServiceWorker()

// How many keys this tab has not finished with, counted from a capture-phase
// listener on the window so a hold is open before anything in this app decides
// what a key means (./quiescence.ts, which says what it covers and what it
// deliberately does not). Here for the reason above it: one keyboard, one
// document, and a listener that lives exactly as long as one.
followKeys()
protectComposition()

// What this deployment is CALLED, and when the process serving it started,
// cross on the socket and land on the tab, the wordmark, the install name
// and the uptime chip — the one ask `named.ts` argues. The readout and
// the ask are this file's because `named.ts` must not import the wire
// (a test of the landing has no socket). Here for the same reason as
// the keys above it: both facts belong to the document, and they
// outlive every component.
followName({
  readout: connectionReadout,
  ask: () => runAsync(olai.procedures.app.get()),
})

// Whether the agent's questions are announced and whether that makes a sound, how much of a
// row is drawn by default, which pages draw their finished work (each outline
// keeps its own pick), whether the file tree draws the outlines olai named for
// itself, what this browser has folded — of the outline and of the directory —
// — document-lifetime until their capability owners are extracted.
// WHICH PLUGINS THIS BUILD HAS, and where each sits in the file's own list —
// said before anything can read either. See the import above.
useBrowserRows(BROWSER_ROWS)
useBundleOrder(bundleRank)

followAlerts()
followDensity()
followDonePrefs()
followFolds()
followFolders()

const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")
useBootStatus(bootStatus(root))

// Providers may arrive before the browser mount; their needs keep them waiting.
await provideFurniture()
await attachRenderer(root)
await firstRoster
await bootstrapBrowser()
