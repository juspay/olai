import type { Row } from "./roster.ts"

import { newestFirst } from "../../attention.ts"

export { newestFirst }

/** Last speech leads; agents not yet heard from follow by their vault edit.
 * Sorting never filters by standing, and the palette uses the uncapped answer. */
export const byActivity = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> => rows.toSorted((a, b) =>
  a.said !== null && b.said !== null ? newestFirst(a.said.at, b.said.at)
    : a.said !== null ? -1 : b.said !== null ? 1
    : newestFirst(a.changed, b.changed))
