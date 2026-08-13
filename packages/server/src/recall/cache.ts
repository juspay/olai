/**
 * Where the index sleeps between serves — and the argument for WHERE.
 *
 * The index is a derived reading of the outlines, so the one thing its
 * storage must never do is look like a second truth. Two candidate homes were
 * on the table (docs/brainstorming/hindsight.md): gitignored under the served
 * directory, or the app's cache dir. It lives in the CACHE DIR
 * (`$XDG_CACHE_HOME/olai/recall/`, keyed by a hash of the served path), and
 * each reason is a collision with something this repo already promised:
 *
 *   - the `commit` tool sweeps "anything untracked that .gitignore does not
 *     cover", so a cache under the served directory would sit in everyone's
 *     pending panel until olai edited THEIR `.gitignore` — a write into a
 *     user's file that nobody asked for, from the product whose whole write
 *     story is validated ops;
 *   - the store WATCHES the served directory; an index that rewrites itself
 *     on every embed batch would have the watcher waking the probe to
 *     discover our own bytes, forever;
 *   - a cache dir is the one place on a machine whose contract is already
 *     "delete freely, everything here can be rebuilt" — which is the pin this
 *     feature ships under.
 *
 * The format is JSONL, one meta line then one row per node: `{id, hash,
 * vector}` with the vector as base64 little-endian f32. The meta line carries
 * the EMBEDDER ID, and a mismatch discards the whole file: vectors from two
 * models share no geometry, and a migrated cache would be a cache that
 * compares them. Any unreadable line does the same — this is a cache, and the
 * honest recovery from a doubtful one is a rebuild, not a salvage.
 *
 * Writes are staged-then-renamed. Two olai processes may serve one directory
 * (`olai web` and `olai mcp` — see `../mcp/serve.ts`), and both may write
 * this file; the rename keeps every version somebody reads WHOLE, and
 * last-write-wins between two processes indexing the same truth converges on
 * the same bytes anyway.
 */

import { Effect, FileSystem, Path } from "effect"
import { createHash } from "node:crypto"
import { homedir } from "node:os"

/** One node's entry: what was embedded (as a content hash) and what it became.
 *  The hash is what makes indexing incremental — an unchanged node is never
 *  re-embedded, across probes and across serves. */
export interface CachedRow {
  readonly hash: string
  readonly vector: Float32Array
}

/** Format version — bumped when a row stops meaning what it meant. */
const FORMAT = 1

interface Meta {
  readonly olaiRecall: number
  readonly embedder: string
}

/** The default home: `$XDG_CACHE_HOME/olai/recall`, with the XDG fallback. */
export const defaultCacheDir = (): string => {
  const xdg = process.env["XDG_CACHE_HOME"]
  const base = xdg !== undefined && xdg !== "" ? xdg : `${homedir()}/.cache`
  return `${base}/olai/recall`
}

/** What the index hashes: the exact text it embeds. Truncated because a hash
 *  of a prefix still changes when the prefix does, and 64 bits is far more
 *  than "did this note change" needs. */
export const hashOf = (text: string): string =>
  createHash("sha256").update(text).digest("hex").slice(0, 16)

/** One file per served directory, keyed by a hash of its resolved path — two
 *  directories never share vectors, and a path never leaks into a filename.
 *  The same {@link hashOf}, so the truncation length is decided once. */
export const cacheFile = (dir: string, root: string): string =>
  `${dir}/${hashOf(root)}.jsonl`

/**
 * Read the cache, or `null` for "build from nothing": absent, unparseable,
 * or written beside a different embedder. All three are the same answer
 * because all three have the same recovery, and a reader told WHICH would
 * have nothing different to do about it.
 */
export const load = (
  file: string,
  embedderId: string,
): Effect.Effect<Map<string, CachedRow> | null, never, FileSystem.FileSystem> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const read = yield* Effect.orElseSucceed(fs.readFileString(file), () => null)
    if (read === null) return null
    const lines = read.split("\n").filter((line) => line !== "")
    if (lines.length === 0) return null
    try {
      const meta = JSON.parse(lines[0] as string) as Meta
      if (meta.olaiRecall !== FORMAT || meta.embedder !== embedderId) return null
      const rows = new Map<string, CachedRow>()
      for (const line of lines.slice(1)) {
        const row = JSON.parse(line) as {
          readonly id: string
          readonly hash: string
          readonly vector: string
        }
        const bytes = Buffer.from(row.vector, "base64")
        rows.set(row.id, {
          hash: row.hash,
          vector: new Float32Array(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength / 4,
          ),
        })
      }
      return rows
    } catch {
      return null
    }
  })

/** Write the whole index, staged beside its destination and renamed over it.
 *  Failure is the CALLER's to log-and-carry-on: an index that cannot sleep is
 *  still an index, and search must not care. */
export const save = (
  file: string,
  embedderId: string,
  rows: ReadonlyMap<string, CachedRow>,
): Effect.Effect<void, never, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function*() {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const meta: Meta = { olaiRecall: FORMAT, embedder: embedderId }
    const lines = [JSON.stringify(meta)]
    for (const [id, row] of rows) {
      lines.push(JSON.stringify({
        id,
        hash: row.hash,
        vector: Buffer.from(
          row.vector.buffer,
          row.vector.byteOffset,
          row.vector.byteLength,
        ).toString("base64"),
      }))
    }
    // Staged then renamed by hand rather than through `@olai/store`'s `Disk`,
    // which owns this exact pair of verbs: that module is built around a
    // SERVED ROOT and reaching for it would mean widening `@olai/store`'s
    // exports so a cache in another directory entirely could borrow two
    // lines. The property both want — a reader never sees half a file — is
    // the rename, and it is spelled here.
    const staged = `${file}.${process.pid}.tmp`
    yield* Effect.gen(function*() {
      yield* fs.makeDirectory(path.dirname(file), { recursive: true })
      yield* fs.writeFileString(staged, lines.join("\n") + "\n")
      yield* fs.rename(staged, file)
    }).pipe(
      Effect.tapError((cause) =>
        Effect.logWarning(
          `recall: could not write the index cache at ${file}: ${String(cause)}`,
        )
      ),
      Effect.ignore,
    )
  })
