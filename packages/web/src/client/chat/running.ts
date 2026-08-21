/**
 * Which of the protocol's tool-call statuses mean the call HAS NOT COME BACK.
 *
 * One line of vocabulary, in a module of its own, because two faces are built
 * on it and they must not be able to disagree: the rail under a spawn says an
 * agent is out ({@link ./spawn.ts}), and the readout on a frame's own line says
 * how long a call has been going ({@link ./elapsed.ts}). Both are drawn from
 * the same row at the same moment, so a status one of them called running and
 * the other did not would put a duration on a row with no live face, or a live
 * face on a row with no duration — one panel saying two things about one call.
 *
 * It was a `const RUNNING` inside `spawn.ts` and the second reader is what
 * moved it: the set is not a fact about spawns, it is a fact about ACP, and the
 * module that draws spawns is no more entitled to own it than the one that
 * draws clocks.
 *
 * THE PROTOCOL'S OWN WORDS and no interpretation of them. `pending` is what the
 * adapter announces EVERY tool call with — it means "announced", not "not
 * started" — so it is a running state here rather than a case to fall through;
 * `spawn.ts` has the long version of that argument. A status this panel has
 * never heard of is not something it will call running, which is the same
 * refusal to invent a fact the header makes for a model id it cannot place.
 */

import type { ChatEntry } from "@olai/surface"

/**
 * Whether a call in this state is one the wire still says is going.
 *
 * Takes the STATUS as the row carries it — `undefined` included, which is how
 * a tool row arrives before anything has said otherwise and how every row that
 * is not a tool call arrives forever. The two are told apart by the caller and
 * not here: `spawn.ts` has already established the row is a spawn when it asks,
 * and `elapsed.ts` refuses an absent status outright, because a `user` message
 * that inherited "pending" would be a paragraph with a stopwatch on it.
 */
export const isRunning = (status: ChatEntry["status"]): boolean =>
  status === "pending" || status === "in_progress"
