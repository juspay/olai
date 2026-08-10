/**
 * The client entry point. It renders; everything else is a module away.
 */

import { retireServiceWorker } from "@kolu/surface-app/lifecycle"
import { render } from "solid-js/web"

import App from "./App.tsx"
import { adoptStoredTheme } from "./theme/state.ts"
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
adoptStoredTheme()

const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")

render(() => <App />, root)
