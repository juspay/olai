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
 * TWO things are derived from that socket, and the second one is the whole of
 * this module's second half. `connectSurface` gives the reactive client AND a
 * transport `status` — but that status calls a RETIRED wire `down`, which is
 * the one state that is not a blip: it means the server was replaced and this
 * link will never dial again. So the wire's own status is not what the UI
 * reads. `createServerLifecycle` is, because it asks the further question the
 * transport cannot: on every open it probes `identity.info` and compares the
 * process id, which is what separates "the same server, briefly gone" from
 * "a different server" — and it reads the terminal `retired` as exactly that,
 * a restart, rather than as a socket that is still trying.
 *
 * The two are not two watchdogs. `connectSurface` already wired the half-open
 * heartbeat (it mints the branded liveness handle the client is built over), so
 * the lifecycle takes `heartbeat: false`: one probe on one wire, with the
 * lifecycle observing the forced reconnects the watchdog performs like any
 * other close.
 */

import { surface } from "@olai/surface"
import { connectSurface, createServerLifecycle } from "@kolu/surface-app/solid"

const url = (): string => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${location.host}/rpc/ws`
}

const connection = await connectSurface({ surface, url })

export const olai = connection.client

const lifecycle = createServerLifecycle({
  wire: connection.link.wire,
  // A member call is an Effect; the lifecycle runs it at its own edge. This is
  // the surface's OWN `identity.info` — olai serves one surface, so the probe
  // sits at the bare `surface/identity/info` with no sibling key in front of it.
  probe: () => olai.procedures.identity.info({}),
  // The watchdog lives in `connectSurface`'s `createLiveSignal` over this same
  // wire, beside the transport it guards and the branded signal the client
  // requires. Opting out here is ownership, not blindness: a second one would
  // mean two `system/live` probes on one socket.
  heartbeat: false,
  // The other half of the server's stale-tab gate. Every observed id is echoed
  // back as the `pid` query parameter on the NEXT dial, so a tab that outlived
  // its server presents an id the new process does not recognise and is closed
  // instead of quietly served — which is the whole reason the id is on the wire.
  // The link retires on that close; the lifecycle reads it as `restarted`.
  onProcessId: connection.echo.remember,
  // A probe that keeps failing would otherwise leave the indicator frozen in
  // whatever it last said, which is the exact silence this module exists to end.
  //
  // Except for the one failure that is not news: a tab the server closes at the
  // handshake gets its socket OPENED first, so the probe that open triggered is
  // in flight when the link retires and fails with `SurfaceTransportRetired`.
  // That is the mechanism working, and the lifecycle has already reported it as
  // a restart — logging it as an error would put a stack trace in the console
  // for the one case the UI is handling properly.
  onProbeError: (err) => {
    if (connection.link.wire.status() === "retired") return
    console.error("identity.info probe failed:", err)
  },
})

/**
 * What the connection is doing, as the lifecycle's own event.
 *
 * The EVENT rather than the `status` projection beside it, because the event is
 * the one that still knows how a restart arrived — a probe that found a new
 * process on an open socket, or the handshake closing this tab for good — and
 * `./connection/status.ts` is where that is turned into something to look at.
 * Read it: an indicator nobody renders is the bug this module used to have.
 */
export const serverLifecycle = lifecycle.lifecycle
