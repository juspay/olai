/**
 * What the composer was ARMED with, resolved against the set.
 *
 * A browser arms a message with node IDS and nothing else
 * ({@link ../../surface/src/index.ts}'s `chat.send`), for `edit.ts`'s reason
 * read one seam over: a title or a `file:line` sent from a tab would be that
 * tab's account of an outline some frames old, free to disagree with the file.
 * The id is the only thing it can say that stays true, and this is where it
 * becomes a sentence — over the SAME {@link Reading} a keystroke's write is
 * judged against, so the node the agent is told about is the node as it is at
 * the moment the turn is accepted.
 *
 * It refuses rather than dropping, and that is the decision worth naming. An
 * armed node that the set no longer declares — deleted, or in a file that
 * stopped parsing — could be left out of the prompt and the message sent
 * anyway; what the agent would then get is "mark this done" with no *this*,
 * and it would guess. So the send comes back as the same `not-found` a tool
 * call gets for the same id (`@olai/ops`' own `notFound`, the same words with
 * the same "did you mean"), the composer puts the message and the chips back,
 * and the person can see which one went.
 *
 * AN ARCHIVED NODE IS NOT ONE OF THOSE, and the paragraph above used to say it
 * was — a claim `byId` never made true, since archiving MOVES a record into an
 * archive with its id intact and only a query's reading leaves it out. Which is
 * the better behaviour as well as the true one: what was put away is reachable
 * at every door that asks for it (#226 took the default presence, never the way
 * to ask), and "why did we put this away?" is a question to be able to ask. So
 * it goes, with the `file` it sits in — and the LINE says which that is
 * (`@olai/chat`'s `lineFor`, which asks the format the same `isTrashed` every
 * other reader of an archive asks), because an agent handed a row that reads
 * like live work will treat it as live work. Nothing about it is decided here:
 * this answers WHICH node, and what the sentence says about one is the sentence
 * writer's.
 *
 * PURE over a reading, like {@link ./edit.ts} and for its reasons: every case
 * is a question about the set, so it is answerable with a value and testable
 * without a server, an agent or a socket.
 */

import {
  isMirror,
  type LocatedRegular,
  type OpFailure,
  type Reading,
} from "@olai/format"
import { notANode, notFound, Query } from "@olai/ops"
import type { NodeContext } from "@olai/surface"
import { Result } from "effect"

/**
 * The armed ids as nodes, in the order they were armed — or the first refusal.
 *
 * Order is the caller's: chips are removed and re-armed, and the strip a person
 * is looking at is the order the prompt should name them in.
 */
export const contextFor = (
  at: Reading,
  ids: ReadonlyArray<string>,
): Result.Result<ReadonlyArray<NodeContext>, OpFailure> => {
  const nodes: Array<NodeContext> = []
  for (const id of ids) {
    const one = nodeContextFor(at, id)
    if (Result.isFailure(one)) return Result.fail(one.failure)
    nodes.push(one.success)
  }
  return Result.succeed(nodes)
}

/** One of them. Both refusals are the ops layer's own sentences (`notFound`,
 *  `notANode`) rather than versions of them worded here: a mirror is no more
 *  describable than it is editable — a placement has no title, no mark and no
 *  ancestry of its own — and an id that is refused by an op and by this should
 *  be refused in one voice. Nothing in the panel can arm a mirror (a row arms
 *  the node it SHOWS), which is why that arm is a guard rather than a case: an
 *  id off the wire is a request, never a fact. */
const nodeContextFor = (
  at: Reading,
  id: string,
): Result.Result<NodeContext, OpFailure> => {
  const located = at.derived.byId.get(id)
  if (located === undefined) return Result.fail(notFound(at.derived, id))
  if (isMirror(located.node)) return Result.fail(notANode(id, located.node.mirror))
  // Situated by the ops layer's own reader, which is what answers `read_node`
  // about this id in the same conversation — so the two cannot describe one
  // node differently. What is TAKEN from it is the subset a context line says:
  // the mark and the edges are the agent's to read for itself, and a prompt is
  // not the place to pre-empt a tool call.
  const { id: found, title, file, line, path } = Query.foundOf(
    at.derived,
    located as LocatedRegular,
  )
  return Result.succeed({ id: found, title, file, line, path })
}
