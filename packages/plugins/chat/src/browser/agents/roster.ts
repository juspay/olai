/** The seven server-owned node-agent standings, and their one presentation.
 * Lifecycle is per node, so this module does not derive it from the foreground
 * chat cell; it only decides how the wire's answer looks. */

import type { AgentStanding, NodeAgentRow } from "olai-plugin-chat/wire"
import { NEEDS_YOU_DOT } from "../../attention.ts"

export type Standing = AgentStanding

/**
 * ONE ROW, as everything in the browser reads it: the wire's row plus the ONE
 * fact derived from it rather than drawn by the server.
 *
 * `unread` is computed where the roster is MINTED (`./answered.tsx`) out of the
 * pair of instants the wire carries, by chat's one predicate for it
 * ({@link ../../attention.ts}'s `unreadOf`) — so the sidebar row, the tab strip
 * and the acknowledgement circuit all read one boolean that was decided once,
 * and the roster's own identity (`rows()`) moves when it moves.
 */
export type Row = NodeAgentRow & { readonly unread: boolean }

/**
 * IS THIS AGENT AWAKE — holding one of the eight seats, with a process behind
 * it?
 *
 * FOUR STANDINGS, in the order a person cares about them: it wants you, it is
 * busy, it is starting, it is ready. The other three are not a seat — `asleep`
 * and `unbound` never had one, and `gone` is a process that died and left the
 * seat it had. The order is the list's (`./activity-order.ts`) and the
 * question is the verbs' (`../verbs.tsx`: there is nothing to put to sleep on
 * a row that is not), so it is declared once, here, beside the table that says
 * what each standing LOOKS like.
 */
export const AWAKE: ReadonlyArray<Standing> = ["needs-you", "working", "waking", "idle"]
export const awake = (standing: Standing): boolean => AWAKE.includes(standing)

/** What each standing is called, how it is painted, and what it means. One table
 *  is read by every face that says HOW AN AGENT STANDS — the Needs you region's
 *  dot, the aside on the outline row, the palette row's hint, and the Chats
 *  row's dot, which is drawn for an awake agent and for no other
 *  (`./Agents.tsx`: a sleeping chat is a thing that is there, not a thing that
 *  is doing something). A row carries its standing as `data-standing` whatever
 *  it draws. */
export const LOOK: Record<Standing, { readonly dot: string; readonly label: string; readonly detail: string }> = {
  "needs-you": {
    dot: NEEDS_YOU_DOT,
    label: "Needs you",
    detail: "Waiting for your answer",
  },
  working: {
    dot: "bg-done animate-pulse",
    label: "Working…",
    detail: "Working on a reply",
  },
  waking: {
    dot: "bg-done animate-pulse",
    label: "Starting…",
    detail: "The agent is starting",
  },
  idle: {
    dot: "bg-done",
    label: "Idle",
    detail: "Ready for your next message",
  },
  gone: {
    dot: "bg-alarm",
    label: "Not running",
    detail: "The agent stopped",
  },
  asleep: {
    dot: "bg-muted/40",
    label: "Asleep",
    detail: "Saved. Open it to continue.",
  },
  unbound: {
    dot: "border border-muted/60",
    label: "No agent",
    detail: "No chat here yet",
  },
}
