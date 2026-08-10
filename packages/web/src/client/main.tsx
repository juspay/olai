/**
 * The client entry point. It renders; everything else is a module away.
 */

import { retireServiceWorker } from "@kolu/surface-app/lifecycle"
import { render } from "solid-js/web"

import App from "./App.tsx"
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

const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")

render(() => <App />, root)
