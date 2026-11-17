/**
 * WHICH CHAT IS AT A PLACE, as the server reads it — the half of the browser's
 * "chat at this address" that the server needs: to refuse a second chat for
 * one place, and to answer another row that asks by address
 * (`./conversations.ts`).
 *
 * Over the format's own reading of a title (`@olai/format`'s `placeWritten`)
 * and its rule about who wins a place (`standIns`), with the one fact a
 * title cannot carry asked of the reading in hand: whether the place is still
 * there. A file the set no longer holds and a row that no longer exists stand
 * for nothing, so their chat rows are ordinary chats again — the browser's
 * rule, read off the same vault.
 */
import { documentAt, type Place, placeWritten, type Reading, type StandIns, standIns, titleAddress } from "@olai/format"

/** The three parts of a reading this module reads — what a published revision
 *  carries, so the roster's last revision answers as well as a fresh read. */
export type Placed = Pick<Reading, "claims" | "set" | "derived">

/** Whether the reading still holds a place. A page that is not a file or a row
 *  is the router's to know, and is taken as written. */
const held = (reading: Placed, place: Place): boolean =>
  place.kind === "file" ? documentAt(reading.set, place.path) !== undefined
    : place.kind === "row" ? reading.derived.byId.has(place.id)
    : true

/** The place a title (or a bare address) stands for, in this reading, or
 *  `null` for one that stands for nothing here. */
export const placeIn = (reading: Placed, title: string): Place | null => {
  const place = placeWritten(reading.claims, title)
  return place !== null && held(reading, place) ? place : null
}

/** Every chat row of a roster, placed. */
export const chatsIn = <Row extends { readonly id: string; readonly title: string }>(
  reading: Placed,
  rows: ReadonlyArray<Row>,
): StandIns<Row> => standIns(rows, (row) => placeIn(reading, row.title))

/** The address a chat row is about, where its title names a place it is the
 *  chat of — what its first message says (`../teaching.ts`'s `ABOUT`). */
export const aboutIn = <Row extends { readonly id: string; readonly title: string }>(
  reading: Placed,
  rows: ReadonlyArray<Row>,
  row: Row,
): string | null => chatsIn(reading, rows).standsIn(row) ? titleAddress(row.title) ?? null : null
