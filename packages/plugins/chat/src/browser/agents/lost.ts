import type { AgentItem } from "@olai/format"

export interface WasTied {
  readonly agent: string
  readonly session: string
}

export type Lost =
  | { readonly kind: "gone" }
  | { readonly kind: "untied"; readonly was: WasTied; readonly path: string }

export const lostOf = (input: {
  readonly item: AgentItem
  readonly standing: "reading" | "never" | "loaded" | undefined
  readonly held: boolean
  readonly tied: boolean
  readonly was: WasTied | null
}): Lost | null => {
  if (input.item.kind !== "note") return null
  if (input.standing !== "loaded") return null
  if (!input.held) return { kind: "gone" }
  if (input.tied || input.was === null) return null
  return { kind: "untied", was: input.was, path: input.item.path }
}
