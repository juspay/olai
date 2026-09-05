/** Module acquisition belongs to a row. A rejected optional module must not
 * prevent independent providers (including the renderer) from mounting. Keep
 * the failures alongside the successful halves so the inspector can explain
 * an absent browser activation without inventing a running fiber. */
export const loadRows = async <T>(rows: ReadonlyArray<{
  readonly id: string
  readonly load: () => Promise<T>
}>): Promise<{ readonly loaded: ReadonlyArray<T>; readonly failed: ReadonlyMap<string, string> }> => {
  const answers = await Promise.allSettled(rows.map((row) => Promise.resolve().then(row.load)))
  const loaded: T[] = []
  const failed = new Map<string, string>()
  answers.forEach((answer, index) => {
    if (answer.status === "fulfilled") loaded.push(answer.value)
    else failed.set(rows[index]!.id, String(answer.reason))
  })
  return { loaded, failed }
}
