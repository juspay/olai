import { bylineOf } from "./byline.ts"

export interface RangRow {
  readonly byline: string
  readonly body: string
  readonly folds: boolean
  readonly open: boolean
}

export const rangRow = (text: string, unfolded: boolean): RangRow => {
  const said = bylineOf(text)
  const folds = said.byline !== ""
  return { byline: said.byline, body: said.body, folds, open: !folds || unfolded }
}
