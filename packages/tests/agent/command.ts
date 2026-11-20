export const commandLine = (prompt: string): string => (prompt.split("\n", 1)[0] ?? "").trim()

export const commandWords = (prompt: string): ReadonlyArray<string> =>
  commandLine(prompt).split(/\s+/)
