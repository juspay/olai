/**
 * WHICH CONVERSATION REPLACED WHICH, where OLAI is the one that replaced it.
 *
 * A listing's rows carry `supersededBy` when the AGENT says so: olai's pinned
 * Claude Code adapter reports a `/clear` in its own corner of `session/list`
 * ({@link ./events.ts}'s `Stored`, `acp/patches/session-list-info.patch`), and
 * every other agent says nothing, in which case a row carries `null` and the
 * picker draws no line. That is a fact somebody SENT, and the list has always
 * drawn nothing else — never a relationship inferred here from two rows that
 * happen to share a title.
 *
 * This is a second fact somebody sent, and the somebody is olai. The *fresh
 * session* affordance opens a conversation for a node agent that already had
 * one and re-points the property at the new one — a supersession olai MADE,
 * with nothing on either agent's disk to say so. Without it written down, a
 * node agent's own previous session comes back as a conversation nobody claims:
 * it would sit under Unassigned inviting somebody to assign it to the node it
 * already belonged to, which is the one node that would refuse it.
 *
 * So the record keeps it ({@link ./sessions.ts}'s `Overheard.superseded`) and
 * this puts it on the rows, at the one door every reader of the listing comes
 * through ({@link ./chat.ts}'s `sessions`). One overlay rather than one per
 * face, because the three faces that read a lineage — the migration list, the
 * panel's *past sessions*, and the picker's own superseded line — must not come
 * to disagree about which conversations a node agent has had.
 *
 * ## THE AGENT'S OWN ANSWER WINS
 *
 * A row that already names a successor keeps the one it names. The agent read
 * its own transcripts; olai read a state file it wrote, which can be older than
 * a `/clear` somebody ran in a terminal afterwards. Where the two disagree, the
 * one closer to the conversation is right — and the case is rare enough to be
 * worth no more than this sentence.
 *
 * ## MATCHED ON THE PAIR, never on the session alone
 *
 * A session id means nothing to the wrong agent, and a listing spans every
 * installed one, so a row is only ever wearing the link written down against
 * its own agent — the rule {@link ./sessions.ts} keeps everywhere.
 *
 * PURE, over the two lists, so what a lineage says is decided in a unit test
 * rather than by opening a picker.
 */

import type { Listed, SessionInfo } from "@olai/surface"

import type { Overheard } from "./sessions.ts"

/**
 * The listing, wearing the supersessions olai made — the same value where
 * there is nothing to add, which is nearly every listing.
 *
 * THE SAME OBJECT, deliberately: a listing is asked for on a click and handed
 * to a browser, and a copy minted for a machine that has never replaced a
 * session would be an allocation per ask for no change at all.
 */
export const succeeded = (
  listed: Listed,
  overheard: ReadonlyArray<Overheard>,
): Listed => {
  const links = overheard.filter((row) => row.superseded !== undefined)
  if (links.length === 0) return listed
  let moved = false
  const sessions = listed.sessions.map((session): SessionInfo => {
    // THE AGENT'S OWN ANSWER WINS — see the header. A row that already names a
    // successor is left exactly as it arrived.
    if (session.supersededBy !== null) return session
    const link = links.find(
      (row) => row.agent === session.agent && row.session === session.id,
    )
    if (link === undefined) return session
    moved = true
    return { ...session, supersededBy: link.superseded ?? null }
  })
  return moved ? { ...listed, sessions } : listed
}
