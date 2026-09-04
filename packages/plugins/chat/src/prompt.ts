/**
 * What olai adds to a message, and where.
 *
 * Two things ride a prompt besides the words: the files attached to it
 * ({@link ./attachments.ts}) and the nodes it is about ({@link ./context.ts}).
 * They are different subjects with different lines, and the RULE for putting
 * either under a message is the same one — which is why it is written here
 * once rather than in both:
 *
 *   - nothing to add changes nothing at all;
 *   - one line per thing, in the order they were given;
 *   - a blank line between what a person wrote and what olai added, so the
 *     message stays the message;
 *   - a message with no words at all is the lines alone. A picture pasted with
 *     nothing typed is "what is this", and a node armed with nothing typed is
 *     "look at this"; both are messages.
 *
 * PURE, and the two callers' own tests cover it through their own line
 * spellings — which is the point: neither of them owns the rule.
 */

export const annotated = (
  said: string,
  lines: ReadonlyArray<string>,
): string => {
  if (lines.length === 0) return said
  const added = lines.join("\n")
  return said === "" ? added : `${said}\n\n${added}`
}
