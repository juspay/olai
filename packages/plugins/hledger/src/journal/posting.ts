import { type Amount, parseAmount } from "./amount.ts"
import { type Tag, tagsIn } from "./tags.ts"

export interface Posting {
  readonly account: string
  readonly virtual: "no" | "unbalanced" | "balanced"
  readonly amount: Amount | null
  readonly inferred: boolean
  readonly cost: string | null
  readonly assertion: string | null
  readonly comment: string | null
  readonly prose: string
  readonly tags: ReadonlyArray<Tag>
}

export interface Stated {
  readonly posting: Posting
  readonly cost: boolean
}

export const postingOf = (raw: string): Stated | null => {
  let content = raw.trim()
  if (content === "") return null
  if (content.startsWith("*") || content.startsWith("!")) content = content.slice(1).trimStart()
  if (content === "") return null

  let end = content.length
  const tab = content.indexOf("\t")
  const gap = content.indexOf("  ")
  if (tab >= 0) end = Math.min(end, tab)
  if (gap >= 0) end = Math.min(end, gap)

  let account = content.slice(0, end).trim()
  let virtual: Posting["virtual"] = "no"
  if (account.startsWith("(") && account.endsWith(")")) {
    virtual = "unbalanced"
    account = account.slice(1, -1).trim()
  } else if (account.startsWith("[") && account.endsWith("]")) {
    virtual = "balanced"
    account = account.slice(1, -1).trim()
  }
  if (account === "") return null

  const rest = content.slice(end)
  const semi = rest.indexOf(";")
  const comment = semi >= 0 ? rest.slice(semi + 1).trim() : null
  let region = (semi >= 0 ? rest.slice(0, semi) : rest).trim()
  let cost: string | null = null
  const atSign = region.indexOf("@")
  if (atSign >= 0) {
    cost = region.slice(atSign).trim()
    region = region.slice(0, atSign).trim()
  }
  let assertion: string | null = null
  const equals = region.indexOf("=")
  if (equals >= 0) {
    assertion = region.slice(equals).trim()
    region = region.slice(0, equals).trim()
  }

  const stated = region === "" ? null : parseAmount(region)
  if (region !== "" && stated === null) return null
  const said = comment === null ? { tags: [], prose: "" } : tagsIn(comment)
  return {
    posting: {
      account,
      virtual,
      amount: stated,
      inferred: false,
      cost,
      assertion,
      comment: comment === "" ? null : comment,
      prose: said.prose,
      tags: said.tags,
    },
    cost: cost !== null,
  }
}
