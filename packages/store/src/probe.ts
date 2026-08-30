/**
 * The probe: the only source of truth about what is on disk.
 *
 * Re-list the tree, re-stat everything, diff against the stamp table, re-read
 * and re-decode ONLY what the stamps say changed. Nothing here is BELIEVED
 * about what happened — not a watcher event, not a write the store itself made
 * — so the probe is idempotent, and the state it produces converges on disk
 * truth after any disturbance whether every event lied or none arrived.
 *
 * A caller does get to say what it has just put on disk — a {@link Probe.run}
 * takes that as an argument — and it is a promise rather than an instruction:
 * the file is listed, statted and read exactly as it would have been, and the
 * promised decode is taken only when the bytes that come back are the promised
 * bytes. Everything above still learns what is on the disk; what it saves is
 * decoding the same bytes twice into two values that a codec would then have to
 * judge twice.
 *
 * The two halves of "what changed" are the two things a store can skip:
 *
 *   - a file whose stamp is unchanged keeps its cached `decode` result, so a
 *     directory of a hundred outlines re-parses the one that was saved;
 *   - a listing identical to the last one produces `null`, so the caller does
 *     not re-validate, does not mint a revision, and does not wake a browser to
 *     tell it nothing happened. That is what makes a backstop every sixty
 *     seconds free.
 *
 * A third thing is skipped one step earlier, and it is not about what changed:
 * a file the codec decodes from its NAME ({@link Codec.byName}) is stamped and
 * diffed like every other, and never opened.
 *
 * A decode FAILURE is cached exactly like a success: the same bytes fail the
 * same way, and re-deriving that on every probe would make a broken file the
 * most expensive one in the directory.
 *
 * One more fact is cached per entry, and it is the one the stamp cannot carry:
 * a fingerprint of the BYTES the file was read as. Stamps are coarse on
 * purpose ({@link ./disk.ts}'s trade), so a caller already holding a reason to
 * ask harder — a write the codec just refused — may ask for the bytes to be
 * compared rather than the stamps ({@link Probe.drifted}). That check costs one
 * file read per asked path and is spent NOWHERE else: it is sixteen
 * characters of hex per cached file forever, in exchange for which the
 * refusal door can tell "the set does not fit the disk" from "the write does
 * not fit the set" without re-reading the directory.
 */

import { Effect, Ref, type Result } from "effect"

import type { Codec } from "./codec.ts"
import { type Disk, sameStamp, type Stamp } from "./disk.ts"
import type { PlatformFailure } from "./errors.ts"

/** Each file of the set as the codec last saw it. `null` from a probe means
 *  "identical to the previous one" — not "empty". */
export type Decoded<F, E> = ReadonlyMap<string, Result.Result<F, E>>

/**
 * What one probe found, and what MOVED to make it that.
 *
 * The diff is not a second walk over the result: it is the stamp comparison the
 * probe already does, kept instead of thrown away. `changed` is what was
 * re-decoded (a new file included, since a file with no stamp is stale by
 * definition) and `removed` is what the listing no longer holds — the same
 * size-check deletion the `settled` test below is asked off.
 *
 * It is PATH talk, not content talk, which is what keeps it in a package that
 * knows nothing about outlines: a consumer that publishes per file learns which
 * files to publish without re-deriving it from a value it was handed whole.
 */
export interface Found<F, E> {
  readonly files: Decoded<F, E>
  /**
   * WHAT EACH OF THOSE FILES WAS AT THE MOMENT IT WAS READ — the same table
   * the diff above was computed from, kept instead of thrown away.
   *
   * It is here for one caller and one purpose: a published revision keeps the
   * stamps it was made from, so a later look at the disk can be measured
   * against THIS answer rather than against whatever the probe's live cache
   * has moved on to ({@link ./vintage.ts}'s `Standing`). Handed out rather
   * than asked for afterwards, because "the stamps this set was read at" stops
   * being answerable the moment the next probe runs.
   *
   * It is the same PATH talk the two lists beside it are, so it costs a
   * package that knows nothing about outlines nothing to carry.
   */
  readonly stamps: ReadonlyMap<string, Stamp>
  /** Re-decoded this probe, in listing order. */
  readonly changed: ReadonlyArray<string>
  /** Gone from the listing since the last probe. */
  readonly removed: ReadonlyArray<string>
}

/**
 * Whether two decoded sets are the SAME MAP: the same paths, IN THE SAME ORDER,
 * each holding the very value the other holds.
 *
 * IDENTITY per entry, not equality — nothing in this package looks inside what
 * a codec decoded to, so it has no way to compare two of them and no business
 * trying. It is enough because identity is a promise this module makes and can
 * keep: a file whose stamp did not move keeps the value it was cached with, and
 * a file a write both decoded and read back holds the value it was promised
 * with ({@link Probe.decode}). Nothing here ever hands out a fresh value for
 * bytes it has already answered about.
 *
 * ORDER COUNTS, and that is not fussiness: a `Map` is ITERATED, a codec is
 * handed the whole map, and what one makes of the order is inside a value this
 * package refuses to look into. Answering a question about one map with a
 * verdict about a differently-ordered one would be this package promising, on a
 * codec's behalf, something only that codec can know — and this package's one
 * promise about order is that it makes none ({@link Codec.validate}).
 *
 * It costs exactly the writes that change the KEY SET: a path that did not
 * exist before is appended to the gate's candidate and comes back in the
 * LISTING's place, so a create that sorts ahead of an existing file
 * re-validates, and one that sorts behind does not. Every write to a file the
 * set already holds leaves the order untouched, which is every keystroke.
 *
 * BELT, and olai's codec is the braces: a set assembled out of this map is put
 * in path order by `assemble` itself, so for THAT codec a re-ordering could no
 * longer change an answer. The belt stays because knowing that is knowing what
 * is inside the value — which is the one thing this package will not do.
 *
 * It lives HERE rather than beside its one caller ({@link ./store.ts}'s
 * `publish`, which spends a verdict on the set it was reached about): the
 * caller asks the question, and this is the module whose answer to it means
 * anything. A difference of any kind — a neighbour re-decoded by the same
 * probe, a file that arrived, left or moved in the order, our own bytes
 * overwritten by somebody else between a rename and the read — comes back
 * `false`.
 */
export const sameDecoded = <F, E>(
  one: Decoded<F, E>,
  other: Decoded<F, E>,
): boolean => {
  if (one.size !== other.size) return false
  // Walked in step rather than looked up, which is the whole of what makes this
  // an answer about the MAP and not about its key set.
  const theirs = other[Symbol.iterator]()
  for (const [path, decoded] of one) {
    const next = theirs.next()
    // `done` cannot be reached past the size check above; it is here because
    // the iterator's type says it can be, and a cast would be a claim about
    // the runtime rather than a reading of it.
    if (next.done === true) return false
    const [theirPath, theirDecoded] = next.value
    if (theirPath !== path || theirDecoded !== decoded) return false
  }
  return true
}

export interface Probe<F, E> {
  /**
   * Look, and say what moved — or `null` for a listing identical to the last.
   *
   * `promised` is what the CALLER has just put on disk ({@link Probe.decode}),
   * and it is a promise rather than an instruction: every file is listed,
   * statted and read exactly as it would have been, and a promised value is
   * taken only where the bytes that come back are the promised bytes. A
   * foreign writer who overwrote the file in the moment between a rename and
   * this read is still what gets published, and this is still what decides.
   *
   * WHY IT IS AN ARGUMENT and not something the probe was told earlier: it is
   * true of exactly one read, the one the caller is asking for here. Held as
   * state it would be an obligation with a collection deadline — a probe
   * landing in between would eat it silently, and a write that never got as
   * far as renaming would leave it lying about — and neither of those is a
   * thing a signature can say. As a parameter its lifetime is the call's.
   */
  readonly run: (
    promised?: ReadonlyMap<string, Promised<F, E>>,
  ) => Effect.Effect<Found<F, E> | null, PlatformFailure>
  /** What the last probe decoded, without going near the disk — empty before
   *  the first one. The write gate needs it: a commit validates the set it
   *  WOULD produce, which is this map with the changed files swapped in, and
   *  asking the disk again for the files it is not touching would be a second
   *  read of the same bytes with a race in between. */
  readonly current: Effect.Effect<Decoded<F, E>>
  /** Whether the last probe FOUND this file — membership, answered without
   *  copying the table {@link current} would hand over. It is what makes an
   *  on-demand read of one file ({@link Store.body}) a read of the SET rather
   *  than of the disk: a path nothing listed is not a file of this store,
   *  whether it was pruned, never claimed by the codec, or spelled to climb out
   *  of the root altogether. */
  readonly holds: (path: string) => Effect.Effect<boolean>
  /**
   * WHICH OF THESE FILES NOW READS AS BYTES the cache did not decode from —
   * the stronger look a REFUSAL pays for.
   *
   * The loop decides on stamps and is entitled to: coarse is the trade it
   * took. A caller holding a "no" from the codec has the one reason the loop
   * never does to open the file instead — so this member re-reads exactly the
   * paths it is handed and compares BYTES, via the fingerprint the read
   * cached. It is the same money argument as the stamp table, one door over:
   * one file read per asked path, spent at refusal time (rare, and already
   * expensive), never per probe.
   *
   * A path the probe does not hold is SKIPPED, not answered — the same
   * membership rule {@link Probe.holds} keeps: it is not this store's file,
   * and there is no cached answer for the disk to disagree with. An entry
   * with no fingerprint is skipped too: a file the codec answers for by NAME
   * ({@link Codec.byName}) gives the set nothing the bytes could change, and
   * one that could not be read never said what its bytes were. What comes
   * back is therefore exactly "the paths a resync would re-answer" — which is
   * all a caller deciding whether to pay for one needs.
   *
   * READ-ONLY, and the one question this probe answers without the store's
   * permit: a stamp, a fingerprint and a cached value are all READ here and
   * none is written, so a probe or a commit interleaving cannot corrupt
   * either side of a comparison — the worst it can do is make an answer one
   * revision early, and the repair that consumes it re-reads everything.
   */
  readonly drifted: (
    paths: Iterable<string>,
  ) => Effect.Effect<ReadonlyArray<string>, PlatformFailure>
  /**
   * Decode bytes a write is ABOUT to put on disk, as the promise {@link run}
   * takes.
   *
   * The write gate decodes what it is about to write in order to validate the
   * set it would make, and then renames the files and asks for a probe — which
   * reads those same bytes back and would decode them a SECOND time, into a
   * value equal to the one already in hand and not the same one. What that
   * costs is not the decode: it is that the two sets are then two different
   * values, so the codec has to judge the whole corpus again to say about the
   * second what it just said about the first ({@link ./store.ts}'s `commit`).
   *
   * PURE, and the only way to make a {@link Promised}: the promise's whole
   * content is "these bytes decode to this value", and a caller pairing the two
   * by hand could pair them wrongly.
   */
  readonly decode: (path: string, contents: string) => Promised<F, E>
  /** Forget these files' stamps, so the next {@link run} re-reads them
   *  whatever the file system says about mtime and size.
   *
   *  This is what makes a commit's own write visible. Stamps are mtime+size
   *  (a deliberately coarse, cheap comparison — see {@link ./disk.ts}), and a
   *  write that lands in the same second at the same length is exactly the
   *  case they cannot see. For a change that arrived from OUTSIDE that is the
   *  accepted trade; for one this process just made it is not, because a
   *  browser waiting on the frame would never get it. */
  readonly forget: (paths: Iterable<string>) => Effect.Effect<void>
}

interface Cached<F, E> {
  readonly stamp: Stamp
  readonly decoded: Result.Result<F, E>
  /** The fingerprint of the bytes `decoded` was decoded FROM, or `null`
   *  where there were no bytes: a file the codec answered by NAME
   *  ({@link Codec.byName}) and one that would not open. Computed at the read
   *  the probe was already doing, spent only by {@link Probe.drifted}. */
  readonly fingerprint: string | null
}

/**
 * A file's content as one word: 64-bit FNV-1a over the string's UTF-16 code
 * units, low byte first, as hex.
 *
 * NOT a security boundary — a caller who can write the file can write any
 * fingerprint's preimage. It is a drift detector: a false answer costs
 * (positive) a resync nobody needed or (negative) the state a refusal one
 * layer above would repair, and at 64 bits over a handful of asked paths
 * neither is a plan. Chosen over the repo's one existing digest helper,
 * {@link ../../state/src/index.ts}'s `digestOf` — sixteen hex of a SHA-256
 * over a PATH, in the package that IS `node:fs`, `node:crypto` and `node:os`
 * — because the question here is a file's BYTES rather than a directory's
 * NAME, and this package's imports are Effect and nothing else and stay
 * that. Chosen over keeping the BYTES too, which is the other honest answer
 * and pins the whole corpus in memory beside the values it decoded to.
 */
const fingerprintOf = (contents: string): string => {
  let hi = 0xcbf29ce4
  let lo = 0x84222325
  // The two bytes of one code unit mixed inline: this fold sits on the READ
  // path as well as the refusal's — it is computed at every read the probe
  // does — so a two-element array allocated per CHARACTER is a real tax on a
  // vault-sized directory at boot, and a `mix` closure per file is not much
  // cheaper.
  for (let at = 0; at < contents.length; at++) {
    const unit = contents.charCodeAt(at)
    lo = (lo ^ (unit & 0xff)) >>> 0
    let product = lo * 0x1b3
    hi = (hi * 0x1b3 + Math.floor(product / 0x100000000) + (lo & 0xffffff) * 0x100) %
      0x100000000
    lo = product % 0x100000000
    lo = (lo ^ (unit >>> 8)) >>> 0
    product = lo * 0x1b3
    hi = (hi * 0x1b3 + Math.floor(product / 0x100000000) + (lo & 0xffffff) * 0x100) %
      0x100000000
    lo = product % 0x100000000
  }
  const hex = (word: number) => word.toString(16).padStart(8, "0")
  return `${hex(hi)}${hex(lo)}`
}

/** One promise a write makes about a path: these bytes, decoded to this. The
 *  probe reading that path either finds those exact bytes and takes the value,
 *  or finds something else and decodes what it found ({@link Probe.decode}). */
export interface Promised<F, E> {
  readonly contents: string
  readonly decoded: Result.Result<F, E>
}

/** One stale file's fresh look: what it now decodes to, and the fingerprint
 *  of the bytes that answer was decoded from. A `null` `decoded` is a file
 *  that was listed and then vanished before it could be read; a `null`
 *  `fingerprint` is one no bytes were read for (a name-answered file, or one
 *  that would not open). */
interface Looked<F, E> {
  readonly decoded: Result.Result<F, E> | null
  readonly fingerprint: string | null
}

export const make = <F, S, E>(
  disk: Disk,
  codec: Codec<F, S, E>,
): Effect.Effect<Probe<F, E>> =>
  Effect.gen(function*() {
    // `null`, not an empty map: an empty directory is a real answer that must
    // be published once, and only "has never been probed" may be indistinct
    // from it.
    const cache = yield* Ref.make<ReadonlyMap<string, Cached<F, E>> | null>(null)

    return {
      current: Effect.map(
        Ref.get(cache),
        (cached) =>
          new Map(
            [...(cached ?? [])].map(([path, { decoded }]) => [path, decoded]),
          ),
      ),

      holds: (path: string) =>
        Effect.map(Ref.get(cache), (cached) => cached?.has(path) === true),

      drifted: (paths) =>
        Effect.gen(function*() {
          const cached = yield* Ref.get(cache)
          if (cached === null) return []
          const drifted: Array<string> = []
          for (const path of new Set(paths)) {
            const entry = cached.get(path)
            // Skipped, not answered: a path that is not a file of this store,
            // and one the store never read the bytes of ({@link Cached}).
            if (entry === undefined || entry.fingerprint === null) continue
            const text = yield* disk.read(path)
            // Gone IS an answer: the cached bytes no longer exist.
            if (text === null || fingerprintOf(text) !== entry.fingerprint) {
              drifted.push(path)
            }
          }
          return drifted
        }),

      forget: (paths: Iterable<string>) =>
        Ref.update(cache, (cached) => {
          if (cached === null) return null
          const kept = new Map(cached)
          for (const path of paths) kept.delete(path)
          return kept
        }),

      decode: (path: string, contents: string) => ({
        contents,
        decoded: codec.decode(path, contents),
      }),

      run: (promised) =>
        Effect.gen(function*() {
          const previous = yield* Ref.get(cache)
          const stamps = yield* disk.listing(codec.match)

          const stale = [...stamps].filter(([path, stamp]) => {
            const cached = previous?.get(path)
            return cached === undefined || !sameStamp(cached.stamp, stamp)
          })
          // Nothing new and nothing gone — so nothing the codec could say has
          // changed. The size check is what catches a DELETION, which leaves no
          // stale entry behind to be noticed by. Asked here, off the one diff,
          // rather than by a second walk that would have to agree with it.
          const settled = previous !== null && stale.length === 0 &&
            previous.size === stamps.size
          if (settled) return null

          // ONE answer per stale file: what it decodes to, and the bytes'
          // fingerprint — or `null` for one that was deleted between the stat
          // and the read.
          const fresh = new Map<string, Looked<F, E>>()
          // The ones the codec answers for by NAME are answered first and never
          // reach the disk at all — not at boot, not when they change
          // ({@link Codec.byName}). Taken out of the list BEFORE the reads rather
          // than resolved inside them: they need no file opened, so they should
          // not be waiting on a permit from a pool that is there to bound how
          // many files are open at once.
          const opening: Array<string> = []
          for (const [path] of stale) {
            const named = codec.byName?.(path) ?? null
            if (named === null) opening.push(path)
            else fresh.set(path, { decoded: named, fingerprint: null })
          }
          for (
            const [path, contents] of yield* Effect.forEach(
              opening,
              (path) =>
                Effect.match(disk.read(path), {
                  onFailure: (failure) => [path, failure] as const,
                  onSuccess: (text) => [path, text] as const,
                }),
              { concurrency: 16 },
            )
          ) {
            if (contents === null) {
              fresh.set(path, { decoded: null, fingerprint: null })
              continue
            }
            if (typeof contents !== "string") {
              // The file is THERE and will not open. A codec that can absorb
              // that as a hole does; one that cannot fails the whole look,
              // which is the directory-level sentence {@link Codec.unreadable}
              // already names.
              const unread = codec.unread?.(contents)
              if (unread === undefined) return yield* Effect.fail(contents)
              // Bytes unknown, and no fingerprint to offer: the failure above
              // is the whole of what the cache may say about this file.
              fresh.set(path, { decoded: unread, fingerprint: null })
              continue
            }
            // A file whose bytes are the ones this caller promised is not decoded
            // again: the value that comes back is the value the write validated,
            // and being the SAME value is what lets the gate publish that verdict
            // rather than reaching a second one about a second set. Anything else
            // — including this path holding something else now — decodes here as
            // it always did.
            const promise = promised?.get(path)
            fresh.set(path, {
              decoded: promise?.contents === contents
                ? promise.decoded
                : codec.decode(path, contents),
              fingerprint: fingerprintOf(contents),
            })
          }

          const next = new Map<string, Cached<F, E>>()
          const changed: Array<string> = []
          for (const [path, stamp] of stamps) {
            const looked = fresh.get(path)
            if (looked === undefined) {
              // Not stale: keep what it decoded to, and the stamp that says so.
              const cached = previous?.get(path)
              if (cached !== undefined) {
                next.set(path, {
                  stamp,
                  decoded: cached.decoded,
                  fingerprint: cached.fingerprint,
                })
              }
              continue
            }
            // Read back as gone — it was deleted between the stat and the read.
            // Leaving it out is what the next probe would conclude anyway, and it
            // is a REMOVAL rather than a change, which the loop below sees.
            if (looked.decoded === null) continue
            next.set(path, {
              stamp,
              decoded: looked.decoded,
              fingerprint: looked.fingerprint,
            })
            changed.push(path)
          }
          // Off the same map the decode loop just built, so "gone" cannot mean
          // one thing here and another there: anything the last probe held that
          // this one does not is removed, whether the listing lost it or the read
          // did.
          const removed: Array<string> = []
          for (const path of previous?.keys() ?? []) {
            if (!next.has(path)) removed.push(path)
          }

          yield* Ref.set(cache, next)
          // ONE walk for both projections. `next` pairs each file's stamp with
          // what it decoded to because that is what a cache entry is; the two
          // things above want are the halves of it, and splitting them here
          // rather than twice keeps the probe's per-run cost one pass over
          // what it found.
          const files = new Map<string, Result.Result<F, E>>()
          const table = new Map<string, Stamp>()
          for (const [path, cached] of next) {
            files.set(path, cached.decoded)
            table.set(path, cached.stamp)
          }
          return { files, stamps: table, changed, removed }
        }),
    }
  })

