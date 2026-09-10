/** Scripted verbs occupy the first line. The remaining prompt carries real
 * binding, node-context and attachment annotations, which callers still read
 * from the original text rather than treating them as command arguments. */
export const commandWords = (prompt: string): ReadonlyArray<string> =>
  (prompt.split("\n", 1)[0] ?? "").trim().split(/\s+/)
