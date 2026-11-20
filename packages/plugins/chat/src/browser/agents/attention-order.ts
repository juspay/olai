import { newestFirst } from "./activity-order.ts"
import type { Row } from "./roster.ts"

export const needing = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> => rows
  .filter(row => row.standing === "needs-you" || row.standing === "gone")
  .toSorted((a, b) => Number(a.standing === "gone") - Number(b.standing === "gone")
    || newestFirst(a.said?.at, b.said?.at))
