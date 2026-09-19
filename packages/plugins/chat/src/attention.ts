/**
 * WHICH CONVERSATIONS NEED A PERSON, as another row reads it — a static door
 * with no live value in it.
 *
 * The row publishes its roster as `chat.state` (`./browser.tsx`); this is the
 * key a consumer names it by, and the narrow shape that consumer may read: the
 * rows and the tab-local folds. The browser's own `Roster` is wider and is not
 * imported here, so a consumer's walk through this door reaches no live module.
 *
 * `olai-plugin-tabs`' `attention` component is the consumer: it puts a dot on a
 * tab whose page is a conversation that needs you. What counts as "this page is
 * that conversation" is {@link isCurrent} — the same predicate the Chats
 * section lights a row with — so the two cannot disagree.
 *
 * Tabs also hands `keep` its current node IDs through this service; chat
 * resolves its own roster and owns non-acquiring wire holds. The server
 * guarantees that those holds never wake a conversation.
 */
import type { Accessor } from "solid-js"

import { serviceTag } from "@olai/plugin-api/contracts"
import { fileNamed, type Route } from "olai-plugin-navigation/routes"

import type { AgentStanding } from "./wire/agents.ts"

/** One row of the roster, as far as a page's reader needs it. */
export interface AttentionRow {
  readonly id: string
  readonly file: string
  readonly standing: AgentStanding
}

export interface Attention {
  /** Keep live conversations read without waking sleeping rows. Claims union;
   * each idempotent release withdraws only its caller's claim. */
  readonly keep: (nodes: Accessor<ReadonlySet<string>>) => () => void
  readonly agents: {
    readonly rows: Accessor<ReadonlyArray<AttentionRow>>
    readonly at: (node: string) => AttentionRow | undefined
  }
  /** Whether a node's conversation is unfolded on its row, in this tab. */
  readonly folding: { readonly unfolded: (node: string) => boolean }
}

export const chatState = serviceTag<Attention>("chat.state")

/** Is `route` the page a conversation row is about — its outline with the
 *  conversation unfolded, or the node's own page? */
export const isCurrent = (route: Route, row: Pick<AttentionRow, "id" | "file">, unfolded: boolean): boolean =>
  (unfolded && fileNamed(route) === row.file)
    || (route.kind === "at" && route.address?.kind === "node" && route.address.id === row.id)

/** The paint of the needs-you dot — the one piece of a standing's look another
 *  row draws (a tab's dot). The rest of the table is chat's (`browser/agents/roster.ts`). */
export const NEEDS_YOU_DOT = "bg-doing"
