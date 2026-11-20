import type { AgentStanding, NodeAgentRow } from "olai-plugin-chat/wire"
import { NEEDS_YOU_DOT } from "../../attention.ts"

export type Standing = AgentStanding

export type Row = NodeAgentRow & { readonly unread: boolean }

export const talking = (row: Pick<NodeAgentRow, "session" | "unopened"> | undefined): boolean =>
  row !== undefined && (row.session !== null || row.unopened === true)

export const AWAKE: ReadonlyArray<Standing> = ["needs-you", "working", "waking", "idle"]
export const awake = (standing: Standing): boolean => AWAKE.includes(standing)

export const seated = (standing: Standing): boolean => awake(standing) || standing === "gone"

/** Tailwind's `ring-*` compiles to a `box-shadow`, and Windows High Contrast
 *  removes box-shadows outright, so the halo is an `outline`: recoloured from
 *  the system palette and kept. */
export const LOOK: Record<Standing, { readonly dot: string; readonly label: string; readonly detail: string }> = {
  "needs-you": {
    dot: NEEDS_YOU_DOT,
    label: "Needs you",
    detail: "Waiting for your answer",
  },
  working: {
    dot: "olai-tone-dot bg-done outline-2 outline-done/35 animate-pulse",
    label: "Working…",
    detail: "Working on a reply",
  },
  waking: {
    dot: "olai-tone-dot bg-done outline-2 outline-done/35 animate-pulse",
    label: "Starting…",
    detail: "The agent is starting",
  },
  idle: {
    dot: "olai-tone-dot bg-done",
    label: "Idle",
    detail: "Ready for your next message",
  },
  gone: {
    dot: "olai-tone-dot bg-alarm",
    label: "Not running",
    detail: "The agent stopped",
  },
  asleep: {
    dot: "olai-tone-dot-quiet bg-muted/40",
    label: "Asleep",
    detail: "Saved. Open it to continue.",
  },
  unbound: {
    dot: "border border-muted/60",
    label: "No agent",
    detail: "No chat here yet",
  },
}
