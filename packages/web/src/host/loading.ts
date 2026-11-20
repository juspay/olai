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
