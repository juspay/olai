import { ROUNDING } from "@olai/surface"

const REVERSALS = 6

const QUIET_MS = 1000

export interface Report {
  readonly height: number
  readonly frame: number
  readonly at: number
}

export interface Echo {
  takes(report: Report): boolean
  fresh(): void
}

export const echo = (): Echo => {
  let lastGap: number | undefined
  let lastRising: boolean | undefined
  let reversals = 0
  let lastReportAt: number | undefined
  return {
    takes({ height, frame, at }) {
      const quiet = lastReportAt === undefined || at - lastReportAt > QUIET_MS
      lastReportAt = at
      const was = lastGap
      lastGap = height - frame
      if (was !== undefined && Math.abs(lastGap - was) <= ROUNDING) return false
      if (quiet) reversals = 0
      const rising = lastGap > 0
      if (lastRising !== undefined && rising !== lastRising) reversals += 1
      lastRising = rising
      return reversals <= REVERSALS
    },
    fresh() {
      lastGap = undefined
      lastRising = undefined
      reversals = 0
      lastReportAt = undefined
    },
  }
}
