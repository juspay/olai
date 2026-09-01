/**
 * THE LAST THING THE AGENT SAID, as ONE LINE — what a node agent's door wears
 * when nobody is looking at its conversation.
 *
 * A door on an outline row has one line to spend and there is exactly one
 * question worth spending it on: *what is this agent on about?* The panel holds
 * one conversation at a time, so for every node agent but the open one there is
 * no transcript here at all — which is why the line is written down beside the
 * binding rather than read off the rows when the door is drawn
 * ({@link ./agents.ts}'s `Bound.said`).
 *
 * ## Why the ROWS and not the wire
 *
 * A turn's prose arrives as hundreds of chunks and settles into one row
 * ({@link ./transcript.ts}'s `say`), so the honest moment to take a line is the
 * TURN BOUNDARY and the honest thing to take it from is the row: the same text
 * a reader has in front of them, after the paragraph is closed. Anything read
 * mid-turn is a prefix, and a door drawn from a prefix says something the agent
 * did not finish saying.
 *
 * ## What counts as the agent's last word
 *
 * The last `agent` row with anything in it, and none of the other five kinds:
 *
 *   - a TOOL row is a call, not a sentence — its title is a verb, and a door
 *     reading `Bash` is a door saying nothing;
 *   - an ASK is the one thing the door already says in its STATE ("needs you"),
 *     so a line repeating it would spend the width twice;
 *   - a NOTICE is olai's own words about the conversation, not the agent's, and
 *     the teaching preamble is one of them ({@link ./teaching.ts}) — a door
 *     quoting olai's instruction back as the agent's latest message would be
 *     the one genuinely misleading thing this could say;
 *   - a USER row is the person's, and a refusal is a failure that has its own
 *     face in the panel.
 *
 * ## And what it does to the words
 *
 * The FIRST non-empty line, clipped. An answer is a paragraph and a door is a
 * line, so the cut has to happen somewhere; here is where, so that the record
 * holds a line rather than a screenful somebody would have to trim at every
 * draw ({@link ./agents.ts}'s `Said.text`). The ellipsis is drawn rather than
 * implied: a clipped line and a line that happened to end there are different
 * facts, and the browser's own truncation cannot tell a reader which it has.
 *
 * PURE, over the rows a transcript already holds, so what a door says is
 * decided in a unit test rather than by running a turn.
 */

import type { ChatEntry } from "@olai/surface"

/**
 * How much of a line is kept.
 *
 * Wider than a door — the door truncates for its own width, per drawing, per
 * viewport — and narrow enough that this is a LINE. What it is really bounding
 * is the record: a state file that grew a paragraph per turn would be a
 * per-directory note that never stops growing, for a face that draws one row of
 * text.
 */
export const KEPT = 200

/**
 * The agent's last word in these rows, as one line — or `null` for a
 * conversation it has not said anything in yet, which is every conversation
 * before its first turn comes back.
 *
 * IN INSERTION ORDER, which is the transcript's own: rows are minted in the
 * order they happen and a `Map` hands them back that way, so the last match is
 * the latest. Walked backwards, because the answer is nearly always the last
 * row or close to it.
 */
export const lastSaid = (entries: ReadonlyMap<string, ChatEntry>): string | null => {
  const rows = [...entries.values()]
  for (let at = rows.length - 1; at >= 0; at--) {
    const row = rows[at]
    if (row === undefined || row.kind !== "agent") continue
    const line = firstLine(row.text)
    if (line !== null) return line
  }
  return null
}

/** The first line with anything on it, clipped to {@link KEPT} — or `null` for
 *  prose that is all whitespace, which is a turn that drew a row and said
 *  nothing in it. */
const firstLine = (text: string): string | null => {
  for (const line of text.split("\n")) {
    const said = line.trim()
    if (said === "") continue
    return said.length <= KEPT ? said : `${said.slice(0, KEPT).trimEnd()}…`
  }
  return null
}
