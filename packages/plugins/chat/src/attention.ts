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
 */
import type { Accessor } from "solid-js"

import { serviceTag } from "@olai/plugin-api/contracts"
import { fileNamed, type Route } from "olai-plugin-navigation/routes"

import type { Look } from "@olai/web/client/readout.ts"

import type { AgentStanding } from "./wire/agents.ts"

/** One row of the roster, as far as a page's reader needs it. */
export interface AttentionRow {
  readonly id: string
  readonly file: string
  readonly standing: AgentStanding
}

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

/** What each of the seven server-owned standings is called, how it is painted,
 *  and what it means. One table, read by the sidebar row, the aside on the
 *  outline, and a tab's dot. Lifecycle is per node, so nothing here derives it
 *  from the foreground chat cell; it only decides how the wire's answer looks. */
export const LOOK: Readonly<Record<AgentStanding, Look>> = Object.freeze({
  "needs-you": {
    dot: "bg-doing",
    label: "needs you",
    detail: "its turn has stopped on a question only you can answer, and nothing times out",
  },
  working: {
    dot: "bg-done animate-pulse",
    label: "working…",
    detail: "a turn is in flight",
  },
  waking: {
    dot: "bg-done animate-pulse",
    label: "starting…",
    detail: "its agent is coming up — a subprocess, a handshake, a replay",
  },
  idle: {
    dot: "bg-done",
    label: "idle",
    detail: "its conversation is open and ready",
  },
  gone: {
    dot: "bg-alarm",
    label: "not running",
    detail: "its agent is not there; this is the one that needs a person",
  },
  asleep: {
    dot: "bg-muted/50",
    label: "asleep",
    detail: "its session is on disk with nothing running it — pressing it opens the conversation",
  },
  unbound: {
    dot: "border border-muted/60",
    label: "no session bound",
    detail: "nobody has bound a conversation to this node agent yet",
  },
})

const instant = (value: string | undefined): number => {
  const parsed = Date.parse(value ?? "")
  return Number.isNaN(parsed) ? -Infinity : parsed
}
/** Vault stamps retain their local offset; compare instants, not spellings. */
export const newestFirst = (a: string | undefined, b: string | undefined): number =>
  instant(b) - instant(a) || 0

/** The rows that need a person, newest first and the ones not running last.
 *  The same order is used by the sidebar and identity-free notification clicks. */
export const needing = <R extends { readonly standing: AgentStanding; readonly said: { readonly at: string } | null }>(
  rows: ReadonlyArray<R>,
): ReadonlyArray<R> => rows
  .filter(row => row.standing === "needs-you" || row.standing === "gone")
  .toSorted((a, b) => Number(a.standing === "gone") - Number(b.standing === "gone")
    || newestFirst(a.said?.at, b.said?.at))
