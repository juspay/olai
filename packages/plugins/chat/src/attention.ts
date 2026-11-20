import type { Accessor } from "solid-js"

import { serviceTag } from "@olai/plugin-api/contracts"
import type { Route } from "olai-plugin-navigation/routes"

import type { AgentStanding, NodeAgentRow } from "./wire/agents.ts"

export interface AttentionRow {
  readonly id: string
  readonly file: string
  readonly kind: "node" | "note"
  readonly standing: AgentStanding
  readonly unread: boolean
}

export const unreadOf = (row: Pick<NodeAgentRow, "said" | "seen">): boolean =>
  row.said !== null && row.said.at !== row.seen

export interface Attention {
  readonly agents: {
    readonly rows: Accessor<ReadonlyArray<AttentionRow>>
    readonly at: (key: string) => AttentionRow | undefined
  }
  readonly folding: { readonly unfolded: (key: string) => boolean }
  readonly isCurrent: (route: Route, row: AttentionRow) => boolean
}

export const chatState = serviceTag<Attention>("chat.state")

export const NEEDS_YOU_DOT = "olai-tone-dot bg-doing"

export const UNREAD_DOT = "olai-tone-dot-quiet bg-muted/60"
