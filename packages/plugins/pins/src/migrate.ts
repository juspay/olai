import { addressWritten, type Shelf } from "@olai/format"
import { legacyZoomHref } from "olai-plugin-navigation/persistence"

export const legacyPins = (shelf: Shelf) => shelf.flatMap(row => {
  const before = addressWritten(row.title), after = legacyZoomHref(before)
  return before === after ? [] : [{ verb: "title" as const, id: row.id, was: row.title,
    title: row.title.replace(before, after), pinned: true as const }]
})
