/** The seven server-owned node-agent standings, and their one presentation.
 * Lifecycle is per node, so this module does not derive it from the foreground
 * chat cell; it only decides how the wire's answer looks. */

import type { AgentStanding, NodeAgentRow } from "olai-plugin-chat/wire"
import type { Look } from "@olai/web/client/readout.ts"
import { NEEDS_YOU_DOT } from "../../attention.ts"

export type Standing = AgentStanding
export type Row = NodeAgentRow

/** What each standing is called, how it is painted, and what it means. One
 * table is read by both the sidebar row and the aside on the outline. */
export const LOOK: Record<Standing, Look> = {
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
