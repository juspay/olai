import type { NodeHit } from "@olai/format"

export interface PlaceCrumb {
  readonly id?: string
  readonly title: string
}

export interface Place {
  readonly file: string
  readonly crumbs: ReadonlyArray<PlaceCrumb>
}

export const nodePlace = (
  hit: Pick<NodeHit, "file" | "path"> & { readonly pathIds?: ReadonlyArray<string> },
): Place => {
  const ids = hit.pathIds?.length === hit.path.length ? hit.pathIds : undefined
  return {
    file: hit.file,
    crumbs: hit.path.map((title, at) => ({ title, ...(ids === undefined ? {} : { id: ids[at]! }) })),
  }
}
