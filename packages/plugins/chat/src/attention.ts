/**
 * WHICH CONVERSATIONS NEED A PERSON, as another row reads it — a static door
 * with no live value in it.
 *
 * The row publishes its roster as `chat.state` (`./browser.tsx`); this is the
 * key a consumer names it by, and the narrow shape that consumer may read: the
 * rows, the one fact about what a person has and has not read, and the
 * tab-local folds. The browser's own `Roster` is wider and is not imported
 * here, so a consumer's walk through this door reaches no live module.
 *
 * `olai-plugin-tabs`' `attention` component is the consumer: it puts a dot on a
 * tab whose page is a conversation that needs you, and a quieter one on a tab
 * whose page holds something nobody has read. What counts as "this page is that
 * conversation" is {@link isCurrent} — the same predicate the Chats section
 * lights a row with — so the two cannot disagree.
 *
 * ## WHY `unread` IS A CONJUNCTION AND NOT TWO INSTANTS ON THE WIRE
 *
 * A row carries `said.at` and `seen`, and every reader could compare them
 * itself. Two readers that did would be two definitions of one word, and the
 * day one of them gains a clause — a grace period, a rule about a conversation
 * whose line was heard while it was on screen — the sidebar and the tab strip
 * would be drawing different facts off the same row. So the comparison is made
 * ONCE, by {@link unreadOf}, and what crosses this door is the answer.
 */
import type { Accessor } from "solid-js"

import { serviceTag } from "@olai/plugin-api/contracts"
import { fileNamed, type Route } from "olai-plugin-navigation/routes"

import type { AgentStanding, NodeAgentRow } from "./wire/agents.ts"

/** One row of the roster, as far as a page's reader needs it. */
export interface AttentionRow {
  readonly id: string
  readonly file: string
  readonly standing: AgentStanding
  /** Whether its agent has said something since anybody last looked at the
   *  conversation — the one fact every face that marks an unread conversation
   *  reads, so that none of them derives it for itself. */
  readonly unread: boolean
}

/**
 * WHETHER A CONVERSATION HAS SAID SOMETHING NOBODY HAS SEEN — the whole of the
 * word, in one place.
 *
 * `said.at !== seen` rather than a comparison of instants: the two are the same
 * STRING when the line has been acknowledged and different strings otherwise —
 * including the `null` of a conversation nobody has looked at since it was
 * heard — so equality is exact, needs no clock, and cannot be off by a
 * millisecond of parsing.
 *
 * A ROW WITH NO LINE IS NEVER UNREAD, which is the case that keeps this honest:
 * a conversation that has been opened and sat in has nothing to have missed,
 * and `seen` may be absent for a session olai set up before this field existed.
 */
export const unreadOf = (row: Pick<NodeAgentRow, "said" | "seen">): boolean =>
  row.said !== null && row.said.at !== row.seen

export interface Attention {
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

/**
 * ... AND THE PAINT OF THE UNREAD DOT, for {@link NEEDS_YOU_DOT}'s reason: the
 * look of a fact chat owns, drawn on a tab by somebody else.
 *
 * MUTED, and that is the whole design of the pair. A conversation that needs an
 * answer is asking for something, and an agent that has merely finished talking
 * is not — so the two marks must not be the same mark, and the quieter of the
 * two is the one that is only news. Where both are true the needs-you dot WINS
 * ({@link ../plugins/tabs/src/contract.ts}'s `Dots.rank`, which is what makes
 * that a rule rather than a registration order).
 */
export const UNREAD_DOT = "bg-muted/60"
