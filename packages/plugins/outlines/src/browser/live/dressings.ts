import { dressed } from "../faces.ts"

import type { Dressing, Dressings } from "./seam.ts"

export const DRESSINGS: Dressings = (word) => {
  const Chip = dressed("outline.row.chip").get(word)
  const Pane = dressed("outline.row.pane").get(word)
  const Block = dressed("outline.row.block").get(word)
  if (Chip === undefined && Pane === undefined && Block === undefined) return undefined
  const dressing: Dressing = {
    ...(Chip === undefined ? {} : { Chip }),
    ...(Pane === undefined ? {} : { Pane }),
    ...(Block === undefined ? {} : { Block }),
  }
  return dressing
}
