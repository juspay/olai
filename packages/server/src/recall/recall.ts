/**
 * The semantic index — the derived reading behind `Query.searchWith`.
 *
 * The FILES STAY THE TRUTH, and this module is arranged so that cannot stop
 * being so. It holds one in-memory map of node id → vector, reconciled
 * against every snapshot the store publishes and slept into a cache file the
 * machine's cache dir owns ({@link ./cache.ts}). Nothing here is ever
 * consulted for what a node SAYS — a search resolves the ids this module
 * answers against the snapshot in hand, so an index that lags (it always
 * lags, by the width of an embed batch) can only miss, never contradict.
 *
 * INCREMENTAL by content hash: a node whose title+note is unchanged is never
 * re-embedded — not across probes, not across serves (the hash sleeps in the
 * cache beside the vector). The store already coalesces a `git pull` of
 * forty files into one snapshot, so the unit of work here is "what actually
 * changed since the last reading", which for the ordinary keystroke is one
 * node. The first serve on a machine with an embedder is the one full build,
 * and it runs behind the boot rather than in it — search is answerable
 * (substring) from the first frame, and paraphrase matches fill in as the
 * index catches up. That order IS the degradation story, and the pin.
 *
 * ZERO LLM IN THE WRITE PATH, structurally: this module subscribes to the
 * snapshot ref and holds no write face of any kind — it could not rewrite a
 * user's words if it wanted to, and `open` is called with nothing that
 * writes.
 *
 * Embedding FAILURE is quiet on the search and loud exactly once in the log:
 * an embedder that dies mid-serve turns paraphrase matches off (empty
 * `nearest`), and substring search never learns it happened. The one thing a
 * failure must not do is surface in a UI as an error, because the feature's
 * absence is not an error — the same rule its absence at boot follows.
 */

import { Query } from "@olai/ops"
import type { LocatedRegular, OutlineSet } from "@olai/format"
import type { Snapshot } from "@olai/store"
import {
  Duration,
  Effect,
  FileSystem,
  Path,
  Ref,
  type Scope,
  Stream,
  SubscriptionRef,
} from "effect"

import { cacheFile, type CachedRow, defaultCacheDir, hashOf, load, save } from "./cache.ts"
import { detectOllama, type Embedder } from "./embedder.ts"

export interface Options {
  /** The served directory, resolved — the cache's key, never read from. */
  readonly root: string
  /** The store's snapshot ref: current value then every revision, which is
   *  exactly the store's own contract and all the indexing loop needs. */
  readonly snapshot: SubscriptionRef.SubscriptionRef<Snapshot<OutlineSet> | null>
  /** THE SEAM. How an embedder is found — Ollama detection by default; a test
   *  hands in a deterministic fake and never requires a live model
   *  (kolu-ci-1). `null` out of this is the ordinary machine. */
  readonly embedder?: Effect.Effect<Embedder | null>
  /** Where the cache sleeps — {@link defaultCacheDir} unless a test says. */
  readonly cacheDir?: string
}

/** What the composition roots hand the ops layer, plus the one hook a test
 *  needs: `settled` resolves when the index has caught up with the snapshot
 *  the store currently holds. Product code never waits on it — waiting for
 *  the index is exactly what search must not do. */
export interface Recall extends Query.Recall {
  readonly settled: Effect.Effect<void>
}

/** Similarity floor under which a neighbour is noise, not a paraphrase.
 *  Tuned against nomic-embed-text, where unrelated notes score ~0.3–0.45 and
 *  restatements ~0.6+; capped results make a floor err low rather than high,
 *  but below this the tail is reliably garbage. */
const FLOOR = 0.5

/** How many nodes go to the embedder in one call. Bounds the damage of a
 *  mid-batch failure and keeps the first full build streaming into the index
 *  rather than arriving all at once at the end. */
const BATCH = 16

/** How much of a node the embedder reads: title and note, the two fields a
 *  person wrote. Bounded, because embedding models read a bounded window and
 *  a hash over an unbounded text would re-embed on changes the model cannot
 *  even see. */
const textOf = (located: LocatedRegular): string => {
  const desc = located.node.desc
  const whole = desc === undefined
    ? located.node.title
    : `${located.node.title}\n\n${desc}`
  return whole.slice(0, 4_000)
}

/** How long the QUERY side waits before answering without the index. The
 *  document side tolerates a model loading from disk; a person at a palette
 *  does not. */
const QUERY_TIMEOUT = Duration.seconds(3)

/** How often an owed cache is written. Long enough that a burst of edits is
 *  one write, short enough that a serve killed uncleanly loses seconds of
 *  embedding rather than a build. */
const SAVE_EVERY = Duration.seconds(5)

/**
 * Stand up the semantic index, or `null` when no embedder is found — and
 * `null` is the whole degradation story: the caller hands it to the ops
 * layer, `searchWith` answers substring-only, and nothing anywhere reports a
 * missing feature.
 *
 * Scoped: the indexing fiber is forked into the caller's scope and dies with
 * it, like the store's own loops and for the same reason.
 */
export const open = (
  options: Options,
): Effect.Effect<
  Recall | null,
  never,
  Scope.Scope | FileSystem.FileSystem | Path.Path
> =>
  Effect.gen(function*() {
    const embedder = yield* (options.embedder ?? detectOllama)
    if (embedder === null) return null
    yield* Effect.logInfo(`recall: semantic search on (${embedder.id})`)

    const file = cacheFile(options.cacheDir ?? defaultCacheDir(), options.root)
    /** The index itself. Filled from the cache by the fiber below rather than
     *  here — the cache is a HEAD START, not a truth, and nothing about
     *  answering a search waits for it: an empty map answers `[]` and the
     *  substring half was never involved. Rows for nodes that no longer exist
     *  are pruned by the first reconcile, rows whose text moved are
     *  re-embedded by hash mismatch. */
    const rows = new Map<string, CachedRow>()
    /** Which ids each FILE contributed, so a reconcile can prune what left a
     *  file it re-read without walking the ones it did not. */
    const filed = new Map<string, ReadonlySet<string>>()

    /** The snapshot revision the index has fully absorbed — what `settled`
     *  waits on. `0` is "none yet"; the store's revisions start at 1. */
    const indexed = yield* SubscriptionRef.make(0)
    /** The last failure said out loud, so a dead embedder is one log line and
     *  not one per probe ({@link ../../store}'s `said`, same shape). */
    const said = yield* Ref.make<string | null>(null)

    /**
     * Whether the cache on disk is behind the map in memory.
     *
     * Writing IS a whole-file rewrite — the file is replaced by a rename, so
     * every reader sees a complete index — and that is affordable only
     * because it is COALESCED: a revision marks the cache owed, and the loop
     * below writes at most once a {@link SAVE_EVERY}, with a last write when
     * the scope closes. Saving inside `reconcile` meant a burst of keystrokes
     * rewrote the entire index once per revision, which for a large corpus is
     * megabytes of base64 per sentence typed. What is lost by deferring is a
     * few seconds of embedding on a hard kill — which the next serve re-earns
     * by hash, because this is a cache.
     */
    let owed = false
    const persist = Effect.suspend(() => {
      if (!owed) return Effect.void
      owed = false
      return save(file, embedder.id, rows)
    })

    const sayOnce = (reason: string) =>
      Effect.flatMap(Ref.get(said), (before) =>
        before === reason ? Effect.void : Effect.andThen(
          Ref.set(said, reason),
          Effect.logWarning(`recall: embedding failed — ${reason}. Paraphrase ` +
            `matches are off until it recovers; substring search is unaffected.`),
        ))

    /**
     * Bring the map in line with one snapshot: prune what left, embed what
     * changed, mark the cache owed. Sequential per snapshot (the stream below
     * runs one at a time), so two reconciles never interleave over `rows`.
     *
     * SCOPED TO THE FILES THAT MOVED, which is the store's own `changed` /
     * `removed` put to the use it was computed for ("a consumer re-deriving
     * it by comparing two snapshots would be the same walk done twice" —
     * `@olai/store`'s `Snapshot`). Without that, one keystroke costs a
     * re-hash of the whole corpus to discover the one node that moved. The
     * FIRST reconcile takes everything, which is also what the store says its
     * first revision names — and is what a cache loaded from a previous serve
     * has to be checked against.
     */
    const reconcile = (snapshot: Snapshot<OutlineSet> | null) =>
      Effect.gen(function*() {
        if (snapshot === null) return
        const derived = Query.index(snapshot.value)
        const first = (yield* SubscriptionRef.get(indexed)) === 0
        const touched: (file: string) => boolean = first
          ? () => true
          : (file) =>
            snapshot.changed.includes(file) || snapshot.removed.includes(file)

        // What the touched files hold NOW — walked over the same nodes a
        // search walks (`Query.regulars`), because an index over nodes the
        // search excludes would answer with ids the search then drops.
        const due: Array<{ id: string; text: string; hash: string }> = []
        const nowFiled = new Map<string, Set<string>>()
        for (const located of Query.regulars(derived)) {
          if (!touched(located.file)) continue
          const id = located.node.id
          const text = textOf(located)
          const hash = hashOf(text)
          const ids = nowFiled.get(located.file) ?? new Set<string>()
          ids.add(id)
          nowFiled.set(located.file, ids)
          if (rows.get(id)?.hash !== hash) due.push({ id, text, hash })
        }

        // What those files held BEFORE and no longer do — the only ids a
        // scoped walk may prune, since every other file is untouched.
        let moved = false
        for (const [was, ids] of filed) {
          if (!touched(was)) continue
          const now = nowFiled.get(was)
          for (const id of ids) {
            if (now?.has(id) === true) continue
            rows.delete(id)
            moved = true
          }
        }
        for (const file of [...filed.keys()]) if (touched(file)) filed.delete(file)
        for (const [file, ids] of nowFiled) filed.set(file, ids)

        for (let at = 0; at < due.length; at += BATCH) {
          const batch = due.slice(at, at + BATCH)
          const embedded = yield* Effect.result(
            embedder.embed("document", batch.map((entry) => entry.text)),
          )
          if (embedded._tag === "Failure") {
            // The index keeps what it has and this snapshot stays un-absorbed;
            // the next revision (or the store's backstop probe) retries. What
            // must not happen is a throw: this fiber is the whole feature.
            yield* sayOnce(embedded.failure.message)
            if (moved || at > 0) owed = true
            return
          }
          batch.forEach((entry, index) => {
            rows.set(entry.id, {
              hash: entry.hash,
              vector: normalised(embedded.success[index] as Float32Array),
            })
          })
          moved = true
        }

        yield* Ref.set(said, null)
        if (moved) owed = true
        yield* SubscriptionRef.set(indexed, snapshot.rev)
      })

    yield* Effect.forkScoped(
      Effect.andThen(
        // The cache, read on THIS fiber rather than on the boot path: it is
        // the whole index as base64, and a serve that waited for it would be
        // a serve whose first frame waited on a cache nothing needs.
        Effect.flatMap(load(file, embedder.id), (slept) =>
          Effect.sync(() => {
            if (slept === null) return
            for (const [id, row] of slept) rows.set(id, row)
          })),
        Stream.runForEach(SubscriptionRef.changes(options.snapshot), reconcile),
      ),
    )

    // The other half of {@link owed}: a slow writer, and a last write on the
    // way out so a serve that indexed something never throws it away.
    yield* Effect.forkScoped(
      Effect.forever(Effect.andThen(Effect.sleep(SAVE_EVERY), persist)),
    )
    yield* Effect.addFinalizer(() => persist)

    const nearest: Query.Recall["nearest"] = (text, limit) =>
      rows.size === 0
        // Nothing indexed yet — the first build is still running, or this
        // machine's embedder went away. Either way a search is answered from
        // the substring half and never waits for this one.
        ? Effect.succeed([])
        : embedder.embed("query", [text.slice(0, 4_000)]).pipe(
          Effect.timeout(QUERY_TIMEOUT),
          Effect.map((embedded) => {
            const query = normalised(embedded[0] as Float32Array)
            const scored: Array<Query.Near> = []
            for (const [id, row] of rows) {
              const score = dot(query, row.vector)
              if (score >= FLOOR) scored.push({ id, score })
            }
            return scored.sort((a, b) => b.score - a.score).slice(0, limit)
          }),
          // A failing embedder turns paraphrase matches off and says so once;
          // it can never fail a search, which is what `nearest`'s unfailing
          // type promises the ops layer.
          Effect.catch((cause: unknown) =>
            Effect.as(sayOnce(String(cause)), [] as ReadonlyArray<Query.Near>)
          ),
        )

    const settled = Effect.gen(function*() {
      const snapshot = yield* SubscriptionRef.get(options.snapshot)
      if (snapshot === null) return
      const target = snapshot.rev
      yield* Stream.runDrain(
        SubscriptionRef.changes(indexed).pipe(
          Stream.filter((rev) => rev >= target),
          Stream.take(1),
        ),
      )
    })

    return { nearest, settled }
  })

/** Unit-length copy, so similarity is one dot product at query time. A zero
 *  vector (an embedder answering nonsense) stays zero and scores 0 against
 *  everything, which is below any floor. */
const normalised = (vector: Float32Array): Float32Array => {
  let sum = 0
  for (const value of vector) sum += value * value
  if (sum === 0) return vector
  const scale = 1 / Math.sqrt(sum)
  const out = new Float32Array(vector.length)
  for (let at = 0; at < vector.length; at++) {
    out[at] = (vector[at] as number) * scale
  }
  return out
}

const dot = (a: Float32Array, b: Float32Array): number => {
  const width = Math.min(a.length, b.length)
  let sum = 0
  for (let at = 0; at < width; at++) {
    sum += (a[at] as number) * (b[at] as number)
  }
  return sum
}
