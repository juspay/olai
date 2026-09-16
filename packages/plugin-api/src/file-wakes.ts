/** Static interpretation of file picks. Callers supply their own live reading. */
import { fileKind, nearestAtOrAbove, type Claims, type Derived } from "@olai/format"
import type { Deliveries, LocalState } from "./services.ts"
import { Effect, Semaphore } from "effect"

export type FileScope = ReturnType<Deliveries["scopes"]>[number] & { readonly file: string; readonly under?: string }
export const fileScopes = (rows: ReturnType<Deliveries["scopes"]>): ReadonlyArray<FileScope> => rows.flatMap(row => {
  if (typeof row.pick === "string") return [{ ...row, file: row.pick }]
  const picked = row.pick as Record<string, unknown> | null
  if (picked && typeof picked === "object" && !Array.isArray(picked) && typeof picked.file === "string") {
    return [{ ...row, file: picked.file, ...(typeof picked.under === "string" ? { under: picked.under } : {}) }]
  }
  return []
})
/** Whole-file choices all hear a claim; only its nearest node choice does. */
export const ringing = (rows: ReadonlyArray<FileScope>, derived: Derived | undefined, file: string, node: string): ReadonlyArray<FileScope> => {
  const here = rows.filter(row => row.file === file && row.current())
  const candidates = new Set(here.flatMap(row => row.under ?? []))
  const nearest = derived ? nearestAtOrAbove(derived, node, candidates) : null
  return here.filter(row => row.under === undefined || row.under === nearest)
}
export type FileFault = "gone" | "unwatchable"
export const fileFault = (claims: Claims, paths: Iterable<string>, file: string): FileFault | null => {
  if (![...paths].includes(file)) return "gone"
  const kind = fileKind(claims, file)
  return kind !== null && claims.byKind.get(kind)?.holds === "nodes" ? null : "unwatchable"
}

/** The file owner persists which broken picks it has already announced.
 * No shared live state: each activation acquires its own instance and IO door. */
export const fileWakeFaults = (local: LocalState, deliveries: Deliveries, judge: (file: string) => FileFault | null, words: Record<FileFault, string>) => Effect.gen(function*() {
  const loaded = yield* local.load
  let marked = new Set(Array.isArray(loaded?.wakeFaults) ? loaded.wakeFaults.filter((key): key is string => typeof key === "string") : [])
  const gate = yield* Semaphore.make(1)
  return gate.withPermit(Effect.gen(function*() {
    const rows = fileScopes(deliveries.scopes())
    const broken = rows.filter(row => judge(row.file) !== null)
    const key = (row: FileScope) => JSON.stringify([row.agent, row.session, row.pick])
    const next = new Set(broken.map(key))
    const fell = broken.filter(row => !marked.has(key(row)))
    if (next.size !== marked.size || [...next].some(key => !marked.has(key))) {
      yield* local.save({ ...loaded, wakeFaults: [...next] })
      marked = next
    }
    for (const row of fell) yield* deliveries.deliver(row, () => {
      const fault = judge(row.file)
      return row.current() && fault !== null ? words[fault] : null
    })
  })).pipe(Effect.catch(error => Effect.logWarning(`could not remember a file wake fault: ${String(error)}`)))
})
