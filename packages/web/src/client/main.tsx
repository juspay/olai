/**
 * The client entry point. It renders; everything else is a module away.
 */

import { registerOrRetireServiceWorker } from "@kolu/surface-app/lifecycle"
import { SurfaceFaultBoundary } from "@kolu/surface-app/solid"
import { render } from "solid-js/web"

import App from "./App.tsx"
import { protectComposition } from "./composition.ts"
import { Fault } from "./errors/Fault.tsx"
import { followFolders } from "./fold/folders.ts"
import { followFolds } from "./fold/memory.ts"
import { trackDesktop } from "./layout/media.ts"
import { followLayout } from "./layout/prefs.ts"
import { followName } from "./named.ts"
import { followKeys } from "./quiescence.ts"
import { runAsync } from "./run.ts"
import { followAlerts } from "./settings/alerts.ts"
import { followDensity } from "./settings/density.ts"
import { followDonePrefs } from "./settings/done.ts"
import { followStoredFont } from "./theme/fontState.ts"
import { followStoredSize } from "./theme/sizeState.ts"
import { followStoredTheme } from "./theme/state.ts"
import { trackVisibleViewport } from "./viewport.ts"
import { provideFurniture } from "./plugins/furniture.tsx"
import { connectionReadout, firstRoster, olai, useBrowserRows } from "./wire.ts"
import { useBundleOrder } from "./plugins/runtime.ts"
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

// How much of the page a phone is actually showing, published as two custom
// properties for whatever is anchored to the bottom of the screen. Started
// here rather than inside a component because it is a property of the
// DOCUMENT, and it lives exactly as long as the document does — which is why
// its teardown is dropped: the only thing that ends this page also ends the
// listeners.
trackVisibleViewport()

// The theme the shell's boot script already put on `<html>`, taken up by the
// app: a stored name no palette offers is forgotten here, and the browser
// chrome catches up with the paper the page is actually painted in. Started
// here for the same reason as the line above — it belongs to the document, and
// it outlives every component.
followStoredTheme()
followStoredFont()
followStoredSize()

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

// Layout preferences (sidebar open/width, chat open/width/snap), whether the
// agent's questions are announced and whether that makes a sound, how much of a
// row is drawn by default, which pages draw their finished work (each outline
// keeps its own pick), whether the file tree draws the outlines olai named for
// itself, what this browser has folded — of the outline and of the directory —
// and the phone/desktop media query — document-lifetime, like the theme.
// WHICH PLUGINS THIS BUILD HAS, and where each sits in the file's own list —
// said before anything can read either. See the import above.
useBrowserRows(BROWSER_ROWS)
useBundleOrder(bundleRank)

followLayout()
followAlerts()
followDensity()
followDonePrefs()
followFolds()
followFolders()
trackDesktop()

const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")

// The boundary is HERE, around the whole app, because a fault in this client
// is not a fault in one screen: the shell is one composition over one
// subscription (App.tsx), and a page that threw halfway through drawing has no
// half worth keeping. Solid unmounts the subtree that faulted either way — the
// choice is only between a card that says so and a white tab.
//
// The boundary is the framework's (`SurfaceFaultBoundary`): it catches,
// records to the console — a boundary SWALLOWS, so without that record the
// fault reaches no console at all — and prints the thrown value verbatim.
// This root does not ride `SurfaceAppProvider`, so the boundary is composed
// standalone; all that stays here is the LOOK.
//
// Nothing above this line is inside it, and that is the honest boundary of what
// a boundary can do. The calls above run before there is a tree to replace, so
// a throw in one of them is a bundle that never started — and the LISTENERS
// they leave behind are outside it forever: a storage event, a visibility
// change and a scroll are not renders, and Solid can only catch what a render
// is doing. Each of those is a handful of lines that touch the document rather
// than the app, which is the reason they were put there and not the reason
// they are safe.
// THE APP'S OWN CONTRACT, on the plugin context, before anything renders — the
// clock and its duration register, the chrome pill's geometry and the popover
// that shares the bar's focus cycle, and a door onto a served file. A browser
// half NAMES these in its `needs` and the runtime holds it `waiting` until
// they exist, so this could in principle be late; it is awaited here because a
// face that draws a beat after its neighbours is a flicker nobody chose, and
// because the ORDER is then a line somebody can read rather than a race
// somebody has to reason about (`./plugins/furniture.tsx`).
await provideFurniture()

// Wait briefly for initial plugin providers before drawing the shell.
await firstRoster

render(
  () => (
    <SurfaceFaultBoundary fault={(text) => <Fault text={text} />}>
      <App />
    </SurfaceFaultBoundary>
  ),
  root,
)
