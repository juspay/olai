import { Slug, isNodeHit, printAddress, type SearchHit } from "@olai/format"

import type { NodeProp } from "olai-plugin-search/ui/props.ts"
import { documentProps, nodeProps } from "olai-plugin-search/ui/props.ts"
import { nodePlace, type Place } from "olai-plugin-search/ui/place.ts"
import { atFile, atNode, lineFragment, type Route } from "olai-plugin-navigation/routes"

export interface HitRow {
  readonly id: string
  readonly label: string
  readonly place: Place
  readonly props: ReadonlyArray<NodeProp>
  readonly route: Route
  readonly from?: string
}

export const hitRow = (hit: SearchHit, query?: string): HitRow => {
  if (isNodeHit(hit)) {
    return {
      id: printAddress(hit.at),
      label: hit.title,
      from: hit.file,
      place: nodePlace(hit),
      props: nodeProps(hit),
      route: atNode(hit.id),
    }
  }
  const path = hit.at.path
  return {
    id: printAddress(hit.at),
    label: hit.title,
    place: { file: path, crumbs: [] },
    from: path,
    props: documentProps(hit),
    route: "line" in hit && hit.line !== undefined
      ? { kind: "at", address: { kind: "heading", path: hit.at.path, slug: Slug.make(lineFragment(hit.line)) }, ...(query?.trim() ? { filter: query } : {}) }
      : atFile(path),
  }
}
