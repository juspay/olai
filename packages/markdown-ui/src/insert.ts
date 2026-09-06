/** A line and where the caret sits in it — what choosing a completion answers
 *  with, because both change together and a caller that set one without the
 *  other would leave the caret in last frame's sentence. */
export interface Written {
  readonly text: string
  readonly caret: number
}

/**
 * The line with the trigger's span REPLACED by `insert` — the tag completion's
 * answer, and with an empty insert the other two's, which take their span out
 * entirely because what they write is not text at all.
 *
 * ONLY A REMOVAL tidies anything, and only its seam: the two spaces a removal
 * brings together give back one, and a removal at the end of the line does not
 * leave the line ending in one. An insert is put in exactly as it is given —
 * a title is stored verbatim, and an editor with an opinion about somebody's
 * spacing is an editor writing words they did not.
 */
export const written = (
  text: string,
  /** WHERE THE SPAN STARTS, which is all this needs of a trigger — a
   *  {@link Trigger} satisfies it, and so does the chat composer's own
   *  ({@link ../chat/completion.ts}), which completes a file path into a
   *  message through this same function. Taking the narrower thing is what
   *  lets the second caller reuse the rule rather than respell it, and there
   *  is only one arithmetic here worth having two copies of. */
  trigger: { readonly from: number },
  insert: string,
  caret: number,
): Written => {
  const head = text.slice(0, trigger.from)
  const tail = text.slice(caret)
  if (insert !== "") {
    return { text: `${head}${insert}${tail}`, caret: head.length + insert.length }
  }
  if (tail === "") return { text: head.trimEnd(), caret: head.trimEnd().length }
  const joined = head.endsWith(" ") && tail.startsWith(" ") ? head.slice(0, -1) : head
  return { text: `${joined}${tail}`, caret: joined.length }
}
