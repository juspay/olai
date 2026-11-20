import { ROUNDING } from "@olai/surface"

const TURNS = 6

const SETTLING = 1000

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
  let gap: number | undefined
  let rose: boolean | undefined
  let turns = 0
  let spoke: number | undefined
  return {
    takes({ height, frame, at }) {
      const quiet = spoke === undefined || at - spoke > SETTLING
      spoke = at
      const was = gap
      gap = height - frame
      if (was !== undefined && Math.abs(gap - was) <= ROUNDING) return false
      if (quiet) turns = 0
      const rising = gap > 0
      if (rose !== undefined && rising !== rose) turns += 1
      rose = rising
      return turns <= TURNS
    },
    fresh() {
      gap = undefined
      rose = undefined
      turns = 0
      spoke = undefined
    },
  }
}
