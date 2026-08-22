/**
 * The client entry point. It renders; everything else is a module away.
 */

import { retireServiceWorker } from "@kolu/surface-app/lifecycle"
import { SurfaceFaultBoundary } from "@kolu/surface-app/solid"
import { render } from "solid-js/web"

import App from "./App.tsx"
import { Fault } from "./errors/Fault.tsx"
import { followFolders } from "./fold/folders.ts"
import { followFolds } from "./fold/memory.ts"
import { trackDesktop } from "./layout/media.ts"
import { followLayout } from "./layout/prefs.ts"
import { followDensity } from "./settings/density.ts"
import { followDoneHidden } from "./settings/done.ts"
import { followOutlinesHidden } from "./settings/hiddenOutlines.ts"
import { followPolicy } from "./settings/followPolicy.ts"
import { followStoredFont } from "./theme/fontState.ts"
import { followStoredSize } from "./theme/sizeState.ts"
import { followStoredTheme } from "./theme/state.ts"
import { trackVisibleViewport } from "./viewport.ts"

// The paired half of the self-destructing `/sw.js` the server serves: a
// browser stuck on a cached bundle from an older olai unregisters it here and
// self-heals on the next load.
retireServiceWorker()

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

// Layout preferences (sidebar open/width, chat open/width/snap), how much of a
// row is drawn by default, what a page does with finished work, whether the
// file tree draws the outlines olai named for itself, what this browser has
// folded — of the outline and of the directory — and the phone/desktop media
// query — document-lifetime, like the theme.
followLayout()
followDensity()
followDoneHidden()
followOutlinesHidden()
followFolds()
followFolders()
trackDesktop()

// ... and the two things on that panel that are NOT this browser's at all: the
// git policy this directory runs under, and whether the operator pinned it
// (`--commit` / `--push`, which draw the rows read-only). Both ride the git
// cell, so this is a subscription rather than a stored value — started here
// beside the followers above because it belongs to the DOCUMENT and outlives
// every component that reads it (`./settings/followPolicy.ts`).
followPolicy()

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
render(
  () => (
    <SurfaceFaultBoundary fault={(text) => <Fault text={text} />}>
      <App />
    </SurfaceFaultBoundary>
  ),
  root,
)
