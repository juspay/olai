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

/** What each standing is called, how it is painted, and what it means. One
 * table is read by both the sidebar row and the aside on the outline. */
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
