/** Scripted verbs occupy the first line. The remaining prompt carries real
 * binding, node-context and attachment annotations, which callers still read
 * from the original text rather than treating them as command arguments. */
export const commandLine = (prompt: string): string => (prompt.split("\n", 1)[0] ?? "").trim()

export const commandWords = (prompt: string): ReadonlyArray<string> =>
  commandLine(prompt).split(/\s+/)
