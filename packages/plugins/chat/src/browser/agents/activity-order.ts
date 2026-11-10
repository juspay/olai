import { AWAKE, awake, type Row } from "./roster.ts"

const instant = (value: string | undefined): number => {
  const parsed = Date.parse(value ?? "")
  return Number.isNaN(parsed) ? -Infinity : parsed
}
/** Vault stamps retain their local offset; compare instants, not spellings. */
export const newestFirst = (a: string | undefined, b: string | undefined): number =>
  instant(b) - instant(a) || 0

/** Last speech leads; agents not yet heard from follow by their vault edit. */
const byLatest = (a: Row, b: Row): number =>
  a.said !== null && b.said !== null ? newestFirst(a.said.at, b.said.at)
    : a.said !== null ? -1 : b.said !== null ? 1
    : newestFirst(a.changed, b.changed)

/**
 * WHICH BAND A ROW IS IN: one per awake standing, in `AWAKE`'s own order, and
 * one shared band for everything that is not awake.
 *
 * Asleep, unbound and gone are ONE band rather than three, because the
 * difference between them is not a difference in urgency — none of them is
 * holding a seat or doing anything — and splitting them would push a chat a
 * person was reading yesterday below one they have never opened.
 */
const band = (row: Row): number => awake(row.standing) ? AWAKE.indexOf(row.standing) : AWAKE.length

/**
 * WHAT IS AWAKE, FIRST — then everything else by when it was last heard.
 *
 * The list used to be sorted by speech alone, and that is a list that cannot
 * answer the question a person asks it: eight agents may be awake at once, and
 * when a ninth is refused for want of a seat the only thing worth knowing is
 * WHICH EIGHT. A chat that spoke ten minutes ago and is now asleep sorted
 * above an agent waiting on an answer, and ten sleeping ones could push every
 * awake row off the end of a ten-row column.
 *
 * The order inside each band is still the old one — newest speech, then vault
 * edit for agents nobody has heard from — so this is the same list with the
 * live chats lifted out of it, rather than a different list. SORTING NEVER
 * FILTERS: every row the roster holds comes back, and the sidebar's cap is
 * applied to the ANSWER (`./Agents.tsx`), which is what keeps an awake row
 * from being hidden by ten sleeping ones. The palette uses the uncapped answer.
 */
export const byActivity = (rows: ReadonlyArray<Row>): ReadonlyArray<Row> =>
  rows.toSorted((a, b) => band(a) - band(b) || byLatest(a, b))
