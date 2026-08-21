/**
 * Whether a TOOL CALL is one that has not come back — the one question both of
 * the panel's live faces are built on.
 *
 * A module rather than a constant inside whichever face asked first, because
 * three now ask and they must not be able to disagree. The rail under a spawn
 * says an agent is out ({@link ./spawn.ts}); the readout on a frame's own line
 * says how long a call has been going ({@link ./elapsed.ts}); and the frame
 * draws the status as a mark, a colour and a spoken word
 * ({@link ./ToolFrame.tsx}). The first two are drawn from the same row at the
 * same moment, so a status one called running and the other did not would put a
 * duration on a row with no live face, or a live face on a row with no
 * duration — one panel saying two things about one call.
 *
 * IT TAKES THE ROW, and that is the whole of what it takes — which is what
 * makes both faces functions of the thing they are drawn beside. Two facts have
 * to be true and the row now carries both:
 *
 *   - **the wire still calls it running** — ACP's own status, in ACP's own
 *     words ({@link ../../../../surface/src/chat.ts}'s `isRunningStatus`,
 *     which is where that vocabulary lives because the SERVER reads it too).
 *     `status` is a tool row's field, so the KIND is checked rather than the
 *     field's absence: an absent status means `pending`, which is a running
 *     state, and guessing from it would put a live face on the sentence
 *     somebody typed;
 *   - **its turn has not ended** — `stranded`, which is the server's own
 *     observation about its own conversation. A status is STICKY: an agent that
 *     died mid-call leaves that row `pending` for as long as the panel is open,
 *     deliberately, because the row is the honest record of a call that was
 *     announced and never came back.
 *
 * THE SECOND ONE USED TO BE A CONVERSATION-LEVEL "is a turn in flight",
 * threaded in from the list, and this is what moved it onto the row: send again
 * in the same transcript — a dead agent's rows are not cleared — and the new
 * turn makes the whole panel live, so last turn's abandoned calls resume
 * looking like work in progress and a five-minute clock appears on them all at
 * once. Whether a call is still going is a fact about the CALL's turn, and no
 * amount of asking the conversation gets there. The faces got simpler by
 * getting more correct: they take a row, and a row is what a face is about.
 *
 * WHAT IS NOT HERE is what a status LOOKS like. The mark, the tone and the
 * spoken word stay in the frame that draws them, and the split is not
 * squeamishness about markup: those three change when the panel's look changes
 * — `SAID` was added the day a screen reader needed one — and this changes when
 * ACP's vocabulary does. Two things keyed by one field, changing for different
 * reasons, are two modules; merging them would put a drawing decision and a
 * protocol fact behind one edit.
 */

import { type ChatEntry, isRunningStatus } from "@olai/surface"

/** A tool call's status as the panel reads it — what the wire said, or
 *  `pending` when it has not said yet.
 *
 *  ONE spelling of that default, which used to be two: the frame needed the
 *  WORD to draw a mark by and the spawn rail needed it to decide whether an
 *  agent was still out, and both wrote `?? "pending"` for the same reason —
 *  that the adapter announces every call with it. Two copies of one convention
 *  is one of them being missed the day the convention moves. */
export const statusOf = (entry: ChatEntry): NonNullable<ChatEntry["status"]> =>
  entry.status ?? "pending"

/**
 * Whether this row is a call that has not come back.
 *
 * `undefined` for the row is answered `false` too, for `laneOf`'s reason: the
 * list holds keys and reads their values a frame behind, so "which row" is a
 * question that can be asked about nothing.
 *
 * It NARROWS, because what it has established is exactly what its callers go on
 * to lean on: a row that got past this is a tool call and is present, so the
 * elapsed readout reads the stamp off it without an optional chain a line below
 * the check that ruled the absence out. A defensive `?.` there would read as if
 * the row might still be missing, in the one place it provably is not.
 */
export const isRunning = (entry: ChatEntry | undefined): entry is ChatEntry =>
  entry?.kind === "tool" && entry.stranded !== true && isRunningStatus(entry.status)
