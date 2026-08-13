/**
 * The one connection, and what it is doing.
 *
 * TOP-LEVEL AWAIT, deliberately: `connectSurface` is async because the dial is
 * an Effect and building the protocol's fibers cannot be run synchronously.
 * Awaiting it here, once, keeps every consumer's import synchronous-looking.
 * It does NOT block on the socket opening — the link constructs the socket and
 * retries on its own fiber — so this is a microtask, not a network wait.
 *
 * This is the only file in the client that knows a websocket exists.
 *
 * TWO things come off that call and BOTH are read here, which is the whole
 * point: this module used to keep `.client` and drop the rest, and a page that
 * cannot say whether it is connected is a page that lies when it is not
 * (juspay/kolu#2133 made the terminal state a required option because of it).
 *
 *   - `readout` is the five states an indicator needs — `connecting`, `live`,
 *     `degraded`, `reconnecting`, `retired` — the wire's own four folded with
 *     the subscription-health fact, so `live` is a claim about what reaches
 *     this page rather than about a socket. It is exported, rendered, and
 *     asserted on.
 *   - `retired` is the handler the seam requires. It cannot be left out, and it
 *     is answered below.
 *
 * The stale-tab handshake itself is no longer wired here at all: the socket
 * probes the reserved `system/identity` member on every open and echoes the
 * server's process id back as `?pid` on the next dial, so the server can
 * recognise a tab that outlived it. That used to be an app's job — an `echo` to
 * feed through a lifecycle's `onProcessId` — and dropping it was exactly how
 * this page came to sit on a dead server looking healthy.
 */

import { surface } from "@olai/surface"
import { surfaceWsUrl } from "@kolu/surface-app"
import { connectSurface } from "@kolu/surface-app/solid"

const connection = await connectSurface({
  surface,
  // The dial URL, derived from the page's own origin by the ONE derivation
  // both legs share (`surfaceWsUrl`): the serving side compares `pathname` for
  // equality, and the scheme swap is the part a hand-spelled copy gets wrong
  // only once the app is served over TLS. This file used to spell both by hand.
  // A THUNK, as it always was, so `location` is read at dial time and a test
  // that imports this module outside a browser never touches it.
  url: () => surfaceWsUrl(location.origin),
  // What happens when the server retires this wire. Required by the seam, with
  // no default, so a wire that compiles has been asked what happens when it dies.
  //
  // What a READER sees is not wired from here: the indicator and the reload
  // screen ride `readout()`, so the retirement has ONE source and the dot and
  // the screen cannot disagree about it. This is the RECORD — one line naming the
  // moment, for whoever is looking at the console of a tab that stopped. (Kolu
  // itself passes a leaf recorder here, for the same reason.) A `warn`, not an
  // `error`: nothing is broken, the server was replaced.
  retired: () =>
    console.warn(
      "olai: the server retired this tab — it was replaced by a newer process, so this page will not update again until it is reloaded",
    ),
})

export const olai = connection.client

/**
 * What the connection is doing — `connecting` / `live` / `degraded` /
 * `reconnecting` / `retired`, with `needsReload` and, when degraded, the names
 * of the subscriptions that stopped. Read it: an indicator nobody renders is
 * the bug this module had. `./connection/status.ts` says what each of the five
 * looks like, and nothing else about them.
 */
export const connectionReadout = connection.readout
