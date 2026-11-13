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
 * IS THIS AGENT AWAKE — doing something, with a process behind it?
 *
 * FOUR STANDINGS, in the order a person cares about them: it wants you, it is
 * busy, it is starting, it is ready. This is the LIST's question
 * (`./activity-order.ts`) and the DOT's (`./Agents.tsx`): what leads the
 * column, and what the colour on a row means.
 */
export const AWAKE: ReadonlyArray<Standing> = ["needs-you", "working", "waking", "idle"]
export const awake = (standing: Standing): boolean => AWAKE.includes(standing)

/**
 * ...AND IS IT HOLDING A SEAT — which is a different question, by exactly one
 * standing.
 *
 * `gone` is a node whose PROCESS died while its scope is still open: the
 * server only says `gone` for a node the scheduler still has a slot for
 * (`server/agents.ts`'s `standingOf`), and that slot is one of the eight
 * `room()` counts. So a stopped agent is holding a seat that nothing will
 * reap on its own — a dead process is not quiet, it is simply not running —
 * and it is the one row where putting a chat to sleep costs nothing at all.
 * The verbs ask THIS question (`../verbs.tsx`, `./AgentPalette.ts`); a row
 * that never had a seat (`asleep`, `unbound`) answers no to both.
 */
export const seated = (standing: Standing): boolean => awake(standing) || standing === "gone"

/** What each standing is called, how it is painted, and what it means. One table
 *  is read by every face that says HOW AN AGENT STANDS — the Needs you region's
 *  dot, the aside on the outline row, the palette row's hint, and the Chats
 *  row's dot, which is drawn for an awake agent and for no other
 *  (`./Agents.tsx`: a sleeping chat is a thing that is there, not a thing that
 *  is doing something). A row carries its standing as `data-standing` whatever
 *  it draws.
 *
 *  THE HALO ON THE TWO BUSY STANDINGS IS NOT DECORATION. Working and idle are
 *  the same `done` dot, and for a year the ONLY thing between them was the
 *  pulse — which is motion, and motion is a thing a reader is allowed to turn
 *  off (`@olai/appearance/chrome.css` stills it for the whole app). A cue that
 *  a preference can delete is a cue that stops being told to the reader who
 *  needed it most, so the fact is drawn twice: a ring that is there whatever
 *  the reader asked for, and a pulse on top of it for whoever is happy to
 *  watch things move. `doing` is not available to say it with — the Chats
 *  column paints a row that NEEDS YOU in that colour, and two standings one
 *  colour apart from nothing is the bug this paragraph is about. */
export const LOOK: Record<Standing, { readonly dot: string; readonly label: string; readonly detail: string }> = {
  "needs-you": {
    dot: NEEDS_YOU_DOT,
    label: "Needs you",
    detail: "Waiting for your answer",
  },
  working: {
    dot: "bg-done ring-2 ring-done/35 animate-pulse",
    label: "Working…",
    detail: "Working on a reply",
  },
  waking: {
    dot: "bg-done ring-2 ring-done/35 animate-pulse",
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
