/** Module acquisition belongs to a row. A rejected optional module must not
 * prevent independent providers (including the renderer) from mounting. Keep
 * the failures alongside the successful halves so the inspector can explain
 * an absent browser activation without inventing a running fiber. */
export class ModuleReloadRequired extends Error {
  constructor(cause: unknown) {
    super(`Retry could not recover this browser module. Reload the page to recover its dependencies. ${String(cause)}`, { cause })
    this.name = "ModuleReloadRequired"
  }
}

export const loadRows = async <T>(rows: ReadonlyArray<{
  readonly id: string
  readonly load: () => Promise<T>
}>): Promise<{ readonly loaded: ReadonlyArray<T>; readonly failed: ReadonlyMap<string, string>; readonly reloadRequired: ReadonlySet<string> }> => {
  const answers = await Promise.allSettled(rows.map((row) => Promise.resolve().then(row.load)))
  const loaded: T[] = []
  const failed = new Map<string, string>()
  const reloadRequired = new Set<string>()
  answers.forEach((answer, index) => {
    if (answer.status === "fulfilled") loaded.push(answer.value)
    else {
      failed.set(rows[index]!.id, String(answer.reason))
      if (answer.reason instanceof ModuleReloadRequired) reloadRequired.add(rows[index]!.id)
    }
  })
  return { loaded, failed, reloadRequired }
}

/** An entry fetch can recover under a fresh URL, but a failed static dependency
 * remains cached under its original URL. Preserve shared Effect/Solid identity:
 * retry the entry once, then explicitly require a user-initiated page reload if
 * it still fails. Browsers do not reliably identify the failed dependency in the
 * rejection, so this is a conservative recovery boundary, not a claim that every
 * second failure is cached. Successful modules retain their identity; unrelated
 * roster changes do not keep retrying a graph that needs a new document. */
export const retryableModule = <T>(
  initial: () => Promise<T>,
  url: () => string | undefined,
  imported: (url: string) => Promise<T>,
): (() => Promise<T>) => {
  let attempts = 0
  let pending: Promise<T> | undefined
  let blocked: ModuleReloadRequired | undefined
  return () => blocked ? Promise.reject(blocked) : pending ??= Promise.resolve().then(() => {
    const target = attempts > 0 ? url() : undefined
    if (target === undefined) return initial()
    const retry = new URL(target, globalThis.location?.href ?? "http://localhost")
    retry.searchParams.set("olai-import-attempt", String(attempts))
    return imported(retry.href)
  }).catch((error) => {
    attempts++
    pending = undefined
    if (attempts > 1) {
      blocked = new ModuleReloadRequired(error)
      throw blocked
    }
    throw error
  })
}
