import type { SurfaceReadout, SurfaceReadoutStatus } from "./status.ts"

const REACHES: Record<SurfaceReadoutStatus, boolean> = {
  connecting: false,
  live: true,
  degraded: true,
  reconnecting: false,
  retired: false,
}

export const reachable = (readout: SurfaceReadout): boolean => REACHES[readout.status]
