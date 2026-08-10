/**
 * What the listener says, in olai's voice.
 *
 * `serveSurfaceApp` narrates every gate and every fault on ONE callback and
 * defaults it to `console`. This is the arm olai passes instead, and it is a
 * separate file for the reason its neighbours are: `allowedOrigins.ts` owns one
 * decision, `clientDist.ts` owns one, and this owns one — what a listener event
 * sounds like in this program's log. It changes when `@olai/log`'s levels or
 * annotations change, or when the framework's event union grows an arm.
 * `listener.ts` changes when the port policy does. Neither is a reason to
 * re-read the other.
 *
 * The POLICY is the primitive's own — loud on every fault, silent on the
 * ordinary — and what differs is only the sink: these are `Effect.log*` lines,
 * so they carry the level `--log-level` filters on, the `root` annotation the
 * composition root set, and the `serve` span, and they leave by whichever
 * stream that subcommand chose. A `console.warn` would still reach a terminal;
 * it just would not be in the logfmt an e2e harness, a journal or a
 * `--log-level` is reading.
 */

import type { SurfaceAppEvent } from "@kolu/surface-app/serve"
import { type Emit, prettyCause } from "@olai/log"
import { Effect } from "effect"

/** Narrate one listener event. `say` is the caller's emitter — a line from a
 *  Node callback, run under the fiber's own logging settings ({@link
 *  ../../log/src/emit.ts}). */
export const report = (event: SurfaceAppEvent, say: Emit): void => {
  switch (event._tag) {
    // A connection opening or closing is the ordinary case and has no line: a
    // reader with a tab open is not news, and one line per socket per reload is
    // how a log stops being read.
    case "Connected":
    case "Disconnected":
      return
    // A tab that presents a DIFFERENT process id is bound to a process that is
    // gone, so it is closed and its wire retires rather than reconnecting into
    // a server whose bundle it does not match. Ordinary after a restart, and
    // worth one line because it explains a tab that stopped updating.
    case "StaleTab":
      say(
        Effect.annotateLogs(Effect.logInfo("stale tab rejected"), {
          claimed: event.claimedPid,
        }),
      )
      return
    // Cross-site websocket hijacking, refused on the raw socket before the
    // upgrade. Nobody's browser does this by accident.
    case "DisallowedOrigin":
      say(
        Effect.annotateLogs(Effect.logWarning("websocket upgrade refused"), {
          origin: event.origin ?? "none",
          url: event.url.pathname,
        }),
      )
      return
    case "SocketError":
      say(
        Effect.annotateLogs(Effect.logWarning("surface socket failed"), {
          why: prettyCause(event.error),
        }),
      )
      return
    // One connection's serving stack, not the listener's: the rest keep
    // serving. Rendered with `prettyCause` because what arrives here is an
    // Effect `Cause`, and a `Cause` read by a template literal is
    // `[object Object]`.
    case "ServingFailed":
      say(
        Effect.annotateLogs(Effect.logWarning("surface connection failed"), {
          why: prettyCause(event.cause),
        }),
      )
      return
  }
}
