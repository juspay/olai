import type { Situated } from "@olai/format"

export const placeOf = (dated: Situated): string =>
  `${dated.shows.file}/${dated.shows.node.id}`
