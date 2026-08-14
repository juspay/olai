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
 * re-embedded — not across snapshots, not across serves (the hash sleeps in
 * the cache beside the vector). The store already coalesces a `git pull` of
 * forty files into one snapshot, so the unit of work here is "what actually
 * changed since the last reading", which for the ordinary keystroke is one
 * node. The first serve over a directory is the one full build (measured: 4.5
 * seconds for this repo's own 148-node roadmap), and it runs behind the boot
 * rather than in it — search is answerable (substring) from the first frame,
 * and paraphrase matches fill in as the index catches up. That order IS the
 * degradation story, and the pin.
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
import type { OutlineSet } from "@olai/format"
import { isMirror, type LocatedRegular } from "@olai/format"
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
import { detectPackaged, type Embedder } from "./embedder.ts"

export interface Options {
  /** The served directory, resolved — the cache's key, never read from. */
  readonly root: string
  /** The store's snapshot ref: current value then every revision, which is
   *  exactly the store's own contract and all the indexing loop needs. */
  readonly snapshot: SubscriptionRef.SubscriptionRef<Snapshot<OutlineSet> | null>
  /** THE SEAM. How an embedder is found — the one the closure carries by
   *  default; a test hands in a deterministic fake and never spawns a model
   *  server (kolu-ci-1). `null` out of this is a tree run without the nix
   *  wrapper, which is an ordinary way to run olai. */
  readonly embedder?: Effect.Effect<
    Embedder | null,
    never,
    Scope.Scope | FileSystem.FileSystem | Path.Path
  >
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

/** How many nodes go to the embedder in one call. Bounds the damage of a
 *  mid-batch failure and keeps the first full build streaming into the index
 *  rather than arriving all at once at the end. */
const BATCH = 16

/** How much of a node reaches the model. bge-small reads 512 tokens and
 *  truncates the rest itself; cutting here rather than there is what keeps the
 *  content hash honest — a hash over text the model cannot see would re-embed
 *  a node on an edit that changed nothing about its vector. A note longer than
 *  this is findable by its opening, not its middle; chunking is a second
 *  design (docs/brainstorming/semantic-recall.md). */
const WINDOW = 1_400

/** How much of a node the embedder reads: title and note, the two fields a
 *  person wrote. */
const textOf = (located: LocatedRegular): string => {
  const desc = located.node.desc
  const whole = desc === undefined
    ? located.node.title
    : `${located.node.title}\n\n${desc}`
  return whole.slice(0, WINDOW)
}

/** How long the QUERY side waits before answering without the index. The
 *  document side tolerates a model loading from disk; a person at a palette
 *  does not. */
const QUERY_TIMEOUT = Duration.seconds(3)

/**
 * Stand up the semantic index, or `null` when no embedder is found — and
 * `null` is the whole degradation story: the caller hands it to the ops
 * layer, `searchWith` answers substring-only, and nothing anywhere reports a
 * missing feature.
 *
 * `OLAI_RECALL=off` is the same `null` by the reader's own choice. It is a
 * documented knob rather than a test hatch (docs/running.md): the index costs
 * a resident model server, and somebody serving a laptop on battery is
 * entitled to decline it. The e2e suite sets it for the scenarios that are
 * not about recall, for the same reason and not a different one.
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
    if ((process.env["OLAI_RECALL"] ?? "").toLowerCase() === "off") {
      yield* Effect.logInfo("recall: OLAI_RECALL=off — search is substring only")
      return null
    }
    const embedder = yield* (options.embedder ?? detectPackaged(options.root))
    if (embedder === null) return null
    yield* Effect.logInfo(`recall: semantic search on (${embedder.id})`)

    const file = cacheFile(options.cacheDir ?? defaultCacheDir(), options.root)
    // The cache is a HEAD START, not a truth: rows for nodes that no longer
    // exist are pruned by the first reconcile, rows whose text moved are
    // re-embedded by hash mismatch. A cold or discarded cache is the same
    // code path with more embedding in it.
    const rows: Map<string, CachedRow> = (yield* load(file, embedder.id)) ??
      new Map()

    /** The snapshot revision the index has fully absorbed — what `settled`
     *  waits on. `0` is "none yet"; the store's revisions start at 1. */
    const indexed = yield* SubscriptionRef.make(0)
    /** The last failure said out loud, so a dead embedder is one log line and
     *  not one per probe ({@link ../../store}'s `said`, same shape). */
    const said = yield* Ref.make<string | null>(null)

    const sayOnce = (reason: string) =>
      Effect.flatMap(Ref.get(said), (before) =>
        before === reason ? Effect.void : Effect.andThen(
          Ref.set(said, reason),
          Effect.logWarning(`recall: embedding failed — ${reason}. Paraphrase ` +
            `matches are off until it recovers; substring search is unaffected.`),
        ))

    /** Bring the map in line with one snapshot: prune what left, embed what
     *  changed, sleep the result. Sequential per snapshot (the stream below
     *  runs one at a time), so two reconciles never interleave over `rows`. */
    const reconcile = (snapshot: Snapshot<OutlineSet> | null) =>
      Effect.gen(function*() {
        if (snapshot === null) return
        const derived = Query.index(snapshot.value)
        const wanted = new Map<string, { text: string; hash: string }>()
        for (const located of derived.nodes) {
          if (isMirror(located.node)) continue
          const text = textOf(located as LocatedRegular)
          wanted.set(located.node.id, { text, hash: hashOf(text) })
        }

        let moved = false
        for (const id of [...rows.keys()]) {
          if (!wanted.has(id)) {
            rows.delete(id)
            moved = true
          }
        }
        const due: Array<{ id: string; text: string; hash: string }> = []
        for (const [id, entry] of wanted) {
          if (rows.get(id)?.hash !== entry.hash) due.push({ id, ...entry })
        }

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
            if (moved || at > 0) yield* save(file, embedder.id, rows)
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
        if (moved) yield* save(file, embedder.id, rows)
        yield* SubscriptionRef.set(indexed, snapshot.rev)
      })

    yield* Stream.runForEach(
      SubscriptionRef.changes(options.snapshot),
      reconcile,
    ).pipe(Effect.forkScoped)

    const nearest: Query.Recall["nearest"] = (text, limit) =>
      Effect.gen(function*() {
        if (rows.size === 0) return []
        const embedded = yield* Effect.result(
          embedder.embed("query", [text.slice(0, WINDOW)]).pipe(
            Effect.timeout(QUERY_TIMEOUT),
          ),
        )
        if (embedded._tag === "Failure") {
          yield* sayOnce(String(embedded.failure))
          return []
        }
        const query = normalised(embedded.success[0] as Float32Array)
        const scored: Array<Query.Near> = []
        for (const [id, row] of rows) {
          const score = dot(query, row.vector)
          // The floor is the EMBEDDER's, because a cosine scale is a fact about
          // a vector space rather than about an index (embedder.ts says why).
          if (score >= embedder.floor) scored.push({ id, score })
        }
        return scored
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
      })

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
