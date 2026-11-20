import { type Derived, narrowedIn, parseFilter, type Shown } from "@olai/format"

import type { Matches } from "./matches.ts"

export const answered = (
  derived: Derived,
  shows: Shown,
  text: string,
  today: string,
): Matches =>
  new Map(
    narrowedIn(derived, shows, parseFilter(text, today))
      .map((one) => [one.id as string, one]),
  )
