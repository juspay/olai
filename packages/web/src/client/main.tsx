/**
 * The client entry point. It renders; everything else is a module away.
 */

import { retireServiceWorker } from "@kolu/surface-app/lifecycle"
import { render } from "solid-js/web"

import App from "./App.tsx"

// The paired half of the self-destructing `/sw.js` the server serves: a
// browser stuck on a cached bundle from an older olai unregisters it here and
// self-heals on the next load.
retireServiceWorker()

const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")

render(() => <App />, root)
