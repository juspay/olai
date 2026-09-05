/** The server selects initial browser rows. A live roster supersedes this
 * read even when it arrives while the HTTP request is still in flight. */
export const bootstrapSelected = async (options: {
  readonly authoritative: () => boolean
  readonly request: () => Promise<Response>
  readonly apply: (names: ReadonlyArray<string>) => Promise<void>
}): Promise<void> => {
  if (options.authoritative()) return
  const response = await options.request()
  if (!response.ok) throw new Error(`Browser bootstrap returned HTTP ${response.status}`)
  const selected: unknown = await response.json()
  if (!Array.isArray(selected) || !selected.every((id) => typeof id === "string")) {
    throw new Error("Invalid browser bootstrap response")
  }
  if (!options.authoritative()) await options.apply(selected)
}
