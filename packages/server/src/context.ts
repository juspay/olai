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
 * armed node that the set no longer declares — archived, renamed, in a file
 * that stopped parsing — could be left out of the prompt and the message sent
 * anyway; what the agent would then get is "mark this done" with no *this*,
 * and it would guess. So the send comes back as the same `not-found` a tool
 * call gets for the same id (`@olai/ops`' own `notFound`, the same words with
 * the same "did you mean"), the composer puts the message and the chips back,
 * and the person can see which one went.
 *
 * PURE over a reading, like {@link ./edit.ts} and for its reasons: every case
 * is a question about the set, so it is answerable with a value and testable
 * without a server, an agent or a socket.
 */

import { ancestorsOf, isMirror, type OpFailure } from "@olai/format"
import { notANode, notFound, type Reading } from "@olai/ops"
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
  return Result.succeed({
    id,
    title: located.node.title,
    file: located.file,
    line: located.line,
    // The canonical chain, outermost first — the same one a node's page draws
    // as breadcrumbs and a search hit carries as `path`. It is what makes a
    // bare "order" mean something in a prompt about a directory of outlines.
    path: ancestorsOf(at.derived, id).map((crumb) => crumb.node.title),
  })
}
