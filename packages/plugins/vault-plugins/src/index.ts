import type { AgentItem } from "@olai/format"
import { PLUGIN_FOLDER, PLUGIN_README_FILE } from "@olai/surface"
import { serviceTag } from "@olai/plugin-api/services"
import type { Effect } from "effect"
export const name = "vault-plugins"
export const chunks = serviceTag<{ readonly chunk: (path: string) => string | null }>("vault-plugins.chunks")

export const slugOf = (title: string): string => {
  const hyphenated = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-")
  let from = 0
  let to = hyphenated.length
  while (from < to && hyphenated[from] === "-") from += 1
  while (to > from && hyphenated[to - 1] === "-") to -= 1
  return hyphenated.slice(from, to)
}

export const PLUGIN_PATH = "/plugins/"

export const pluginReadme = (word: string): string => `${PLUGIN_FOLDER}${word}/${PLUGIN_README_FILE}`

export const readmeItem = (word: string): AgentItem => ({ kind: "note", path: pluginReadme(word) })

export interface ApprovalRequest {
  readonly name: string
  readonly version: string
  readonly forever: boolean
}

export interface Approvals {
  readonly approve: (request: ApprovalRequest) => Effect.Effect<unknown, { readonly message: string }>
}
export const approvals = serviceTag<Approvals>("vault-plugins.approval")

export interface NewPlugin {
  readonly open: () => void
}
export const newPlugin = serviceTag<NewPlugin>("vault-plugins.new-plugin")
