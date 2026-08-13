/**
 * The nodes a message is ABOUT, on their way into a prompt.
 *
 * The sibling of {@link ./attachments.ts}'s `promptWith`, and deliberately the
 * same shape of answer: one line per thing, appended under what was typed. A
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

import type { NodeContext } from "@olai/surface"

/** One node, as the agent reads it. */
export const lineFor = (node: NodeContext): string => {
  const where = node.path.length === 0
    ? `${node.file}:${node.line}`
    : `${node.file}:${node.line}; under ${node.path.join(" › ")}`
  return `Node in context: \`${node.id}\` — ${node.title} (${where})`
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
): string => {
  if (nodes.length === 0) return said
  const named = nodes.map(lineFor).join("\n")
  return said === "" ? named : `${said}\n\n${named}`
}
