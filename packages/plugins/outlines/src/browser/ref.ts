import type { LocatedRegular } from "@olai/format"

export interface NodeRef {
  readonly id: string
  readonly title: string
  readonly from: string
}

export const refOf = (at: LocatedRegular): NodeRef => ({
  id: at.node.id,
  title: at.node.title,
  from: at.file,
})
