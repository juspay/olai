import type { SurfaceAppEvent } from "@kolu/surface-app/serve"
import { type Emit, prettyCause } from "@olai/log"
import { Effect } from "effect"

export const report = (event: SurfaceAppEvent, say: Emit): void => {
  switch (event._tag) {
    case "Connected":
    case "Disconnected":
      return
    case "StaleTab":
      say(
        Effect.annotateLogs(Effect.logInfo("stale tab rejected"), {
          claimed: event.claimedPid,
        }),
      )
      return
    case "DisallowedOrigin":
      say(
        Effect.annotateLogs(Effect.logWarning("websocket upgrade refused"), {
          origin: event.origin ?? "none",
          url: event.url.pathname,
        }),
      )
      return
    case "GenerationRefused":
      say(
        Effect.annotateLogs(Effect.logError("surface generation refused — this socket was dropped"), {
          url: event.url.pathname,
          why: prettyCause(event.error),
        }),
      )
      return
    case "UpgradeHeadersRefused":
      say(
        Effect.annotateLogs(Effect.logWarning("upgrade headers refused — this socket is anonymous"), {
          url: event.url.pathname,
          why: prettyCause(event.error),
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
    case "ServingFailed":
      say(
        Effect.annotateLogs(Effect.logWarning("surface connection failed"), {
          why: prettyCause(event.cause),
        }),
      )
      return
    default: {
      const unreported: never = event
      return unreported
    }
  }
}

export const readFailed = (stream: string, error: unknown, say: Emit): void => {
  say(
    Effect.annotateLogs(Effect.logWarning("a live reading could not be re-read"), {
      stream,
      why: prettyCause(error),
    }),
  )
}
