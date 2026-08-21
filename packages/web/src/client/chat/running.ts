/**
 * What the wire says about a TOOL CALL's state, and the one thing most of the
 * panel wants to know from it: has it come back?
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
 * IT TAKES THE ROW, not the status, and that is the whole of why it can be
 * asked safely from anywhere. `status` is a TOOL row's field: every other kind
 * of row carries none, and a predicate over the bare field would have to answer
 * `undefined` either "not running" (which is wrong for a call the panel has
 * only just been told about — see below) or "running" (which puts a stopwatch
 * on the sentence somebody typed). The precondition is "this is a tool call",
 * so the precondition is checked here rather than remembered by each caller.
 *
 * THE PROTOCOL'S OWN WORDS and no interpretation of them. `pending` is what the
 * adapter announces EVERY tool call with — it means "announced", not "not
 * started" — so it is a running state rather than a case to fall through, and
 * it is what a row with nothing said about it yet is taken to be;
 * {@link ./spawn.ts} has the long version of that argument. A status this panel
 * has never heard of is not something it will call running, which is the same
 * refusal to invent a fact the header makes for a model id it cannot place.
 *
 * WHAT IS NOT HERE is what a status LOOKS like. The mark, the tone and the
 * spoken word stay in the frame that draws them, and the split is not
 * squeamishness about markup: those three change when the panel's look changes
 * — `SAID` was added the day a screen reader needed one — and this changes when
 * ACP's vocabulary does. Two things keyed by one field, changing for different
 * reasons, are two modules; merging them would put a drawing decision and a
 * protocol fact behind one edit.
 */

import type { ChatEntry } from "@olai/surface"

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
 * Whether this row is a call the wire still says is going.
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
  entry?.kind === "tool" && RUNNING.has(statusOf(entry))

/** The statuses that mean it has not come back. A call that has completed or
 *  failed has no live half and is drawn by the mark and the report the frame
 *  already carries. */
const RUNNING: ReadonlySet<string> = new Set(["pending", "in_progress"])
