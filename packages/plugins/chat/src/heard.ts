/**
 * THE LAST THING THE AGENT SAID, as ONE LINE — what a node agent's door wears
 * when nobody is looking at its conversation.
 *
 * A door on an outline row has one line to spend and there is exactly one
 * question worth spending it on: *what is this agent on about?* The panel holds
 * one conversation at a time, so for every node agent but the open one there is
 * no transcript here at all — which is why the line is written down beside the
 * binding rather than read off the rows when the door is drawn
 * ({@link ./sessions.ts}'s `Overheard.said`).
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
 * ## The instant is the ROW'S, and never the moment this was asked
 *
 * A door draws *7m ago* off this stamp, so what it has to mean is WHEN THE
 * WORDS WERE SAID. Reading the clock at the turn boundary looked like the same
 * thing and is not: this is asked at EVERY turn boundary, and a turn that adds
 * no prose of its own re-offers the line before it — so the clock would stamp
 * a sentence from an hour ago as *just now*, on the one feature whose whole
 * claim is that it says what olai heard. The row carries the instant it was
 * written ({@link ChatEntry}'s `since`); that is the answer.
 *
 * IT IS STILL "WHILE OLAI WAS WATCHING", and the resume case is where that
 * qualification does its work: a replay re-mints the stored rows, so a resumed
 * conversation's old prose carries a `since` of the resume rather than of the
 * day it was said. What keeps the door honest across that is the RECORD, which
 * treats unchanged prose as nothing to write ({@link ./sessions.ts}'s `said`) —
 * so a resumed session keeps the stamp it already had until the agent actually
 * says something new.
 *
 * ## And what it does to the words
 *
 * The FIRST non-empty line, clipped. An answer is a paragraph and a door is a
 * line, so the cut has to happen somewhere; here is where, so that the record
 * holds a line rather than a screenful somebody would have to trim at every
 * draw ({@link ./sessions.ts}'s `Said.text`). The ellipsis is drawn rather than
 * implied: a clipped line and a line that happened to end there are different
 * facts, and the browser's own truncation cannot tell a reader which it has.
 *
 * PURE, over the rows a transcript already holds, so what a door says is
 * decided in a unit test rather than by running a turn.
 */

import type { ChatEntry } from "olai-plugin-chat/wire"
import type { Said } from "./sessions.ts"

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
 * the latest.
 *
 * WALKED FORWARD, KEEPING THE LAST, and not backwards — because a map can only
 * be stepped from the front, so walking it the other way means copying every
 * row of the conversation into an array first. This is asked at every turn
 * boundary, of a transcript that grows all session; the counter beside it
 * ({@link ./chat.ts}'s `asking`) walks the same map the same way for the same
 * reason. The two readings answer identically: a blank last row keeps the line
 * before it either way.
 */
export const lastSaid = (entries: ReadonlyMap<string, ChatEntry>): Said | null => {
  let held: Said | null = null
  for (const row of entries.values()) {
    if (row.kind !== "agent") continue
    const line = firstLine(row.text)
    if (line !== null) held = { text: line, at: row.since }
  }
  return held
}

/**
 * The first line with anything on it, clipped to {@link KEPT} — or `null` for
 * prose that is all whitespace, which is a turn that drew a row and said
 * nothing in it.
 *
 * SCANNED RATHER THAN SPLIT, which is `@olai/format`'s own `firstLine`
 * argument word for word: `split("\n")` allocates every line of a paragraph to
 * throw all but the first away, and what this is handed is a whole answer.
 * Its rules are a document's — frontmatter off, heading marks off — so this is
 * its scan rather than a call to it.
 */
const firstLine = (text: string): string | null => {
  let at = 0
  while (at < text.length) {
    const end = text.indexOf("\n", at)
    const said = (end === -1 ? text.slice(at) : text.slice(at, end)).trim()
    if (said !== "") return said.length <= KEPT ? said : `${said.slice(0, KEPT).trimEnd()}…`
    if (end === -1) break
    at = end + 1
  }
  return null
}
