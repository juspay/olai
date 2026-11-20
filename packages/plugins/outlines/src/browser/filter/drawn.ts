import type { Selected, TrashGroup } from "@olai/format"
import {
  datedIn,
  keeping,
  keepingDated,
  keepingOwed,
  matchedIn,
  owedIn,
  rowsIn,
} from "@olai/format"

import type { Drawn } from "../page.ts"

export const narrowed = (drawn: Drawn, matched: Selected): Drawn => {
  switch (drawn.kind) {
    case "tree":
      return { kind: "tree", rows: keeping(drawn.rows, matched) }
    case "day":
      return { kind: "day", groups: keepingDated(drawn.groups, matched), notes: [] }
    case "agenda":
      return { kind: "agenda", agenda: keepingOwed(drawn.agenda, matched) }
    case "trash":
      return { ...drawn, groups: keepingArchives(drawn.groups, matched) }
    case "none":
      return drawn
  }
}

const keepingArchives = (
  groups: ReadonlyArray<TrashGroup>,
  matched: Selected,
): ReadonlyArray<TrashGroup> =>
  groups.flatMap((group) => {
    const rows = keeping(group.rows, matched)
    return rows.length === 0 ? [] : [{ ...group, rows }]
  })

export const placesIn = (drawn: Drawn): number => {
  switch (drawn.kind) {
    case "tree":
      return rowsIn(drawn.rows)
    case "day":
      return datedIn(drawn.groups)
    case "agenda":
      return owedIn(drawn.agenda)
    case "trash":
      return drawn.groups.reduce((total, group) => total + rowsIn(group.rows), 0)
    case "none":
      return 0
  }
}

export const matchesIn = (drawn: Drawn, matched: Selected): number => {
  switch (drawn.kind) {
    case "tree":
      return matchedIn(drawn.rows, matched)
    case "day":
      return datedIn(keepingDated(drawn.groups, matched))
    case "agenda":
      return owedIn(keepingOwed(drawn.agenda, matched))
    case "trash":
      return drawn.groups.reduce(
        (total, group) => total + matchedIn(group.rows, matched),
        0,
      )
    case "none":
      return 0
  }
}
