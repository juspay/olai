/** The seven server-owned node-agent standings, and their one presentation.
 * Lifecycle is per node, so this module does not derive it from the foreground
 * chat cell; it only decides how the wire's answer looks. */

import type { AgentStanding, NodeAgentRow } from "@olai/surface"

import type { Look } from "../readout.ts"

export type Standing = AgentStanding
export type Row = NodeAgentRow

/** What each standing is called, how it is painted, and what it means. One
 * table is read by both the sidebar row and the door on the outline. */
export const LOOK: Record<Standing, Look> = {
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
}
