/**
 * WHICH AGENT'S WORK IS OPEN — the one piece of state the preview has, and the
 * reason it is a module rather than a signal inside the shelf.
 *
 * A subagent's calls are no longer in the transcript ({@link ./lanes.ts}'s
 * `filedUnder`), so there are two doors onto them and they are in different
 * components: the strip above the scroll while the agent is out
 * ({@link ./Watching.tsx}), and the spawning row's own door for the rest of the
 * conversation ({@link ./Transcript.tsx}). A signal owned by the thing being
 * opened would have to be reached down into from both, and a signal owned by
 * the panel would be threaded through every component between. It is one fact —
 * *the reader is looking at this agent* — and it is held where
 * {@link ./folds.ts} holds its own: module-scoped, keyed by the transcript key,
 * stored nowhere and sent nowhere.
 *
 * BY THE `Agent` FRAME'S KEY, which is the same string a subagent's rows carry
 * as `parent` and the same string the strip carries as `row`. One spelling, so
 * a door cannot open onto a lane that is not the one it named — and so the two
 * doors onto one agent are, provably, one door.
 *
 * ONE AT A TIME. Five agents out is five doors, and a shelf that stacked them
 * would be the transcript's own problem moved up the panel: the thing this
 * feature exists to stop is a fan-out taking the screen. So opening one closes
 * the last, and the strip is the tab bar it is chosen from.
 *
 * IT SURVIVES THE AGENT FINISHING, which is the whole reason it is a KEY rather
 * than anything read off the live list. An agent that reports back while its
 * work is open leaves the strip at that moment; the row it was opened by is
 * still where it was born, its calls are still filed under it, and a shelf that
 * closed itself would take the record away at the exact moment the reader had
 * finished waiting for it.
 *
 * CLEARED WHEN THE CONVERSATION CHANGES, for {@link ./folds.ts}'s reason turned
 * round: a fold is remembered across conversations because the SAME id is the
 * same line, and a transcript key is not — the next conversation mints its own,
 * and a stale one would leave the shelf open on nothing. The panel says when
 * ({@link ./state.ts} already watches the session id for the thumbnails).
 */

import { createSignal } from "solid-js"

const [open, setOpen] = createSignal<string | null>(null)

/** The `Agent` frame whose calls are being read, or `null` — which is nearly
 *  every moment of nearly every conversation. */
export const previewing = open

/** Whether THIS frame is the open one. Spelled here rather than compared at
 *  each door, so that "open" is one question with one answer. */
export const isPreviewing = (row: string): boolean => open() === row

/** Open this agent's work — or close it, when it is the one already open. The
 *  door is the same control both ways round, because a reader who presses the
 *  agent they are already reading means *put it away*. */
export const togglePreview = (row: string): void => {
  setOpen((was) => (was === row ? null : row))
}

/** ... and close whatever is open, from a control that is not a door: the
 *  shelf's own dismiss, and the conversation changing under it. */
export const closePreview = (): void => {
  setOpen(null)
}
