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

/** Browsers retain a rejected import by URL. Retry just that entry with a new
 * query; its relative imports keep the original singleton dependency graph.
 * Retain successful modules across compositions, including a recovered module,
 * so a sibling retry never re-evaluates working plugin code. */
export const retryableModule = <T>(
  initial: () => Promise<T>,
  url: () => string | undefined,
  imported: (url: string) => Promise<T>,
): (() => Promise<T>) => {
  let attempts = 0
  let pending: Promise<T> | undefined
  return () => pending ??= Promise.resolve().then(() => {
    const target = attempts > 0 ? url() : undefined
    if (target === undefined) return initial()
    const retry = new URL(target, globalThis.location?.href ?? "http://localhost")
    retry.searchParams.set("olai-import-attempt", String(attempts))
    return imported(retry.href)
  }).catch((error) => {
    attempts++
    pending = undefined
    throw error
  })
}
