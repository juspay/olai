import type {
  DegradedReadout,
  SurfaceReadout,
  SurfaceReadoutStatus,
} from "@kolu/surface-app/solid"

import type { Look } from "../readout.ts"
import { reachable } from "./reaching.ts"

export type { SurfaceReadout, SurfaceReadoutStatus }

type Degraded = DegradedReadout["status"]

const DEGRADED: Degraded = "degraded"

export type { Look }

export const LOOK: Record<Exclude<SurfaceReadoutStatus, Degraded>, Look> = {
  connecting: {
    tone: "quiet",
    label: "Connecting…",
    detail: "Reaching the server.",
  },
  live: {
    tone: "healthy",
    label: "Connected",
    detail: "Changes to your files show up here as they happen.",
  },
  reconnecting: {
    tone: "notice",
    label: "Reconnecting…",
    detail: "Connection lost. What you see may be out of date.",
  },
  retired: {
    tone: "alarm",
    label: "The server restarted",
    detail: "Reload the page to keep working.",
  },
}

const rowsOf = (stopped: ReadonlyArray<string>): ReadonlyArray<string> =>
  [...new Set(stopped.map((id) => id.split("/")[0] ?? id))]

export const lookOf = (readout: SurfaceReadout): Look =>
  readout.status !== DEGRADED ? LOOK[readout.status] : {
    tone: "notice",
    label: "Partly connected",
    detail: `Some updates aren't arriving (${rowsOf(readout.stopped).join(", ")}).`,
  }

export const frozenLookOf = (readout: SurfaceReadout): { readonly title: string; readonly line?: string } =>
  readout.needsReload || readout.status === DEGRADED
    ? { title: lookOf(readout).label, line: lookOf(readout).detail }
    : readout.status === CONNECTING
      ? { title: LOOK.connecting.label }
      : { title: "Connection lost", line: LOOK.reconnecting.label }

const CONNECTING: SurfaceReadoutStatus = "connecting"

export const isDegraded = (readout: SurfaceReadout): boolean =>
  readout.status === DEGRADED

export const isFrozen = (readout: SurfaceReadout, urged: boolean): boolean =>
  !reachable(readout) && (urged || readout.presentingDown)
