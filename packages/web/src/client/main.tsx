/**
 * The client entry point. It renders; everything else is a module away.
 */

import { retireServiceWorker } from "@kolu/surface-app/lifecycle"
import { ErrorBoundary } from "solid-js"
import { render } from "solid-js/web"

import App from "./App.tsx"
import { followChatOpen } from "./chat/open.ts"
import { Fault } from "./errors/Fault.tsx"
import { trackDesktop } from "./layout/media.ts"
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

// Layout preferences (sidebar open/width, chat open/width/snap) and the
// phone/desktop media query — document-lifetime, like the theme.
followChatOpen()
trackDesktop()

const root = document.getElementById("root")
if (root === null) throw new Error("no #root element")

// The boundary is HERE, around the whole app, because a fault in this client
// is not a fault in one screen: the shell is one composition over one
// subscription (App.tsx), and a page that threw halfway through drawing has no
// half worth keeping. Solid unmounts the subtree that faulted either way — the
// choice is only between a card that says so and a white tab.
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
    <ErrorBoundary
      fallback={(error: unknown) => {
        // The RECORD, and it is not decoration: a boundary SWALLOWS. Without
        // this line the fault reaches no console at all — Solid re-throws only
        // when nothing catches — so a page that faulted after its first frame
        // would fail a browser test as a bare timeout on a missing element,
        // with the `there should be no page errors` assertion beside it green.
        // One line naming the moment, the way wire.ts records a retired socket.
        console.error("olai: this client threw while drawing the page —", error)
        return <Fault error={error} />
      }}
    >
      <App />
    </ErrorBoundary>
  ),
  root,
)
