import { type Address, addressOf, printAddress } from "./address.ts"
import { writtenTags } from "./derive.ts"
import { type Face } from "./document.ts"
import { recordContributions } from "./documents.ts"
import { type Claims } from "./kinds.ts"
import { isRegular, type Located } from "./node.ts"

export const WAYS = ["see", "mention", "link"] as const
export type Way = (typeof WAYS)[number]

export interface Contribution {
  readonly key: string
  readonly way: Way
  readonly at: Located | undefined
  readonly address?: Address
}

export const contributionsOf = (
  claims: Claims,
  face: Face,
  records: ReadonlyArray<Located> | undefined,
): ReadonlyArray<Contribution> => {
  const found: Array<Contribution> = []
  if (records === undefined) {
    for (const link of face.links) {
      found.push({ key: printAddress(link), way: "link", at: undefined, address: link })
    }
    for (const tag of face.tags) {
      if (tag.charAt(0) !== "@") continue
      found.push({ key: tag, way: "mention", at: undefined })
    }
    return found
  }
  for (const located of records) {
    if (!isRegular(located)) continue
    for (const written of recordContributions(claims, located)) {
      found.push({ key: printAddress(written.address), way: written.way, at: located, address: written.address })
    }
    for (const tag of writtenTags(located.node)) {
      if (tag.charAt(0) !== "@") continue
      found.push({ key: tag, way: "mention", at: located })
    }
  }
  return found
}