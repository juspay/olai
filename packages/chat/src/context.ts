/**
 * The nodes a message is ABOUT, on their way into a prompt.
 *
 * The sibling of {@link ./attachments.ts}'s `promptWith` — literally, now: the
 * RULE for putting lines under a message is {@link ./prompt.ts}'s and this
 * owns only the line. One line per thing, appended under what was typed. A
 * picture reaches the agent as a PATH it reads itself; a node reaches it as an
 * ID it can name in a tool call. Neither rides the prompt as content, and that
 * is the same argument twice — the bytes of a screenshot and the records of a
 * subtree are both copies, and a copy in a stored session is a copy that stops
 * being true the moment anything writes.
 *
 * What the line carries besides the id is what makes the id READABLE by a
 * person watching, and it is the set's own answer rather than a browser's: the
 * title, `file:line`, and the ancestors that make a bare "order" mean something
 * ({@link ../../surface/src/chat.ts}'s `NodeContext`, resolved by the server
 * against the same reading a keystroke's write is judged against).
 *
 * The id is spelled in BACKTICKS, which is not decoration: it is how every one
 * of olai's own tools spells an id in its description, it is how an agent
 * writes one back in its prose, and it is the shape the panel makes clickable
 * ({@link ../../web/src/client/chat/refs.ts}). One spelling, three readers.
 *
 * PURE, and tested as such.
 */

import { isArchived } from "@olai/format"
import type { NodeContext } from "@olai/surface"

import { annotated } from "./prompt.ts"

/**
 * One node, as the agent reads it. The `file:line` is spelled once and what
 * varies is the tail: this line is a contract with two other files (the
 * scripted agent parses it, the panel makes the same spelling pressable), and
 * half of it drifting is not a thing to leave to two arms of a ternary.
 *
 * `; archived` is the one clause that is not a fact about WHERE the node is but
 * about what to do with it. A node that was put away can be named on a message
 * — that is deliberate, and it is how "why did we put this away?" gets asked —
 * and no tool refuses a write into an archive, so a row that arrived reading
 * exactly like live work would be ticked off like live work. The `file:line`
 * carries `Archive.olai` already; a filename is a thing to notice, and this is
 * a thing that was said.
 *
 * ASKED OF THE FILE, here, rather than carried as a second field beside it: it
 * is `isArchived`'s answer about `node.file` and nothing else, so a boolean on
 * the wire would be a pair for every producer of a context to keep true, and
 * this format's rule for what an archive IS frozen into a schema — where the
 * 2026-08-17 ruling moved this very area. One fact, one place, one reader.
 */
export const lineFor = (node: NodeContext): string => {
  const under = node.path.length === 0 ? "" : `; under ${node.path.join(" › ")}`
  const away = isArchived(node.file) ? "; archived" : ""
  return `Node in context: \`${node.id}\` — ${node.title} (${node.file}:${node.line}${under}${away})`
}

/**
 * What was typed, with the nodes it is about named under it.
 *
 * Under rather than over, which is {@link ./attachments.ts}'s order and for its
 * reason: the message is what a person wrote, and everything olai adds to it is
 * an annotation on the end. A message with nothing typed at all is the lines
 * alone — a node armed and sent with no words is "look at this", exactly as a
 * screenshot pasted with no words is "what is this".
 */
export const promptWith = (
  said: string,
  nodes: ReadonlyArray<NodeContext>,
): string => annotated(said, nodes.map(lineFor))
