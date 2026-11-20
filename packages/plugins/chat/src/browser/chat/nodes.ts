import type { SearchField } from "@olai/format"
import type { NodeHit } from "@olai/format"

import { nodePlace, type Place } from "olai-plugin-search/ui/place.ts"

export interface NodeMatch {
  readonly id: string
  readonly label: string
  readonly from: string
  readonly place: Place
  readonly note: boolean
}

export const nodeMatches = (
  hits: ReadonlyArray<NodeHit>,
): ReadonlyArray<NodeMatch> =>
  hits.map((hit) => ({
    id: hit.id,
    label: hit.title.trim() === "" ? hit.id : hit.title,
    from: hit.file,
    place: nodePlace(hit),
    note: hit.matched !== undefined && !SHOWN_ON_THE_ROW.has(hit.matched),
  }))

const SHOWN_ON_THE_ROW: ReadonlySet<SearchField> = new Set(["title", "id", "tag"])
