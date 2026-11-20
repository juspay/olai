import { Effect, Ref, type Result } from "effect"

import type { Codec } from "./codec.ts"
import { type Disk, sameStamp, type Stamp } from "./disk.ts"
import type { PlatformFailure } from "./errors.ts"

export type Decoded<F, E> = ReadonlyMap<string, Result.Result<F, E>>

export interface Found<F, E> {
  readonly files: Decoded<F, E>
  readonly stamps: ReadonlyMap<string, Stamp>
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

export const identicalDecodedInOrder = <F, E>(
  one: Decoded<F, E>,
  other: Decoded<F, E>,
): boolean => {
  if (one.size !== other.size) return false
  const theirs = other[Symbol.iterator]()
  for (const [path, decoded] of one) {
    const next = theirs.next()
    if (next.done === true) return false
    const [theirPath, theirDecoded] = next.value
    if (theirPath !== path || theirDecoded !== decoded) return false
  }
  return true
}

const READERS = 16

export interface Probe<F, E> {
  readonly run: (
    promised?: ReadonlyMap<string, Promised<F, E>>,
  ) => Effect.Effect<Found<F, E> | null, PlatformFailure>
  readonly current: Effect.Effect<Decoded<F, E>>
  readonly holds: (path: string) => Effect.Effect<boolean>
  readonly drifted: (
    paths: Iterable<string>,
  ) => Effect.Effect<ReadonlyArray<string>, PlatformFailure>
  readonly decode: (path: string, contents: string) => Promised<F, E>
  readonly forgetStamps: (paths: Iterable<string>) => Effect.Effect<void>
  readonly revalidate: Effect.Effect<void>
}

interface Cached<F, E> {
  readonly stamp: Stamp | null
  readonly decoded: Result.Result<F, E>
  readonly fingerprint: string | null
}

const fingerprintOf = (contents: string): string => {
  let hi = 0xcbf29ce4
  let lo = 0x84222325
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

export interface Promised<F, E> {
  readonly contents: string
  readonly decoded: Result.Result<F, E>
}

interface Looked<F, E> {
  readonly decoded: Result.Result<F, E> | null
  readonly fingerprint: string | null
}

export const make = <F, S, E>(
  disk: Disk,
  codec: Codec<F, S, E>,
): Effect.Effect<Probe<F, E>> =>
  Effect.gen(function*() {
    const cache = yield* Ref.make<ReadonlyMap<string, Cached<F, E>> | null>(null)

    const revalidation = yield* Ref.make(false)

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
          const opening: Array<readonly [string, string]> = []
          for (const path of new Set(paths)) {
            const entry = cached.get(path)
            if (entry === undefined || entry.fingerprint === null) continue
            opening.push([path, entry.fingerprint])
          }
          const looked = yield* Effect.forEach(
            opening,
            ([path, fingerprint]) =>
              Effect.map(disk.read(path), (text) =>
                text === null || fingerprintOf(text) !== fingerprint ? path : null),
            { concurrency: READERS },
          )
          return looked.filter((path) => path !== null)
        }),

      revalidate: Ref.set(revalidation, true),

      forgetStamps: (paths: Iterable<string>) =>
        Ref.update(cache, (cached) => {
          if (cached === null) return null
          const kept = new Map(cached)
          for (const path of paths) {
            const entry = kept.get(path)
            if (entry !== undefined) kept.set(path, { ...entry, stamp: null })
          }
          return kept
        }),

      decode: (path: string, contents: string) => ({
        contents,
        decoded: codec.decode(path, contents),
      }),

      run: (promised) =>
        Effect.gen(function*() {
          const mustRevalidate = yield* Ref.getAndSet(revalidation, false)
          const previous = yield* Ref.get(cache)
          const stamps = yield* disk.listingArmingWatchers(codec.match)

          const stale = [...stamps].filter(([path, stamp]) => {
            const cached = previous?.get(path)
            return cached === undefined || cached.stamp === null || !sameStamp(cached.stamp, stamp)
          })
          const settled = !mustRevalidate && previous !== null && stale.length === 0 &&
            previous.size === stamps.size
          if (settled) return null

          const fresh = new Map<string, Looked<F, E>>()
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
              { concurrency: READERS },
            )
          ) {
            if (contents === null) {
              fresh.set(path, { decoded: null, fingerprint: null })
              continue
            }
            if (typeof contents !== "string") {
              const unread = codec.unread?.(contents)
              if (unread === undefined) return yield* Effect.fail(contents)
              fresh.set(path, { decoded: unread, fingerprint: null })
              continue
            }
            const promise = promised?.get(path)
            fresh.set(path, {
              decoded: promise?.contents === contents
                ? promise.decoded
                : codec.decode(path, contents),
              fingerprint: fingerprintOf(contents),
            })
          }

          const next = new Map<string, Cached<F, E> & { readonly stamp: Stamp }>()
          const changed: Array<string> = []
          for (const [path, stamp] of stamps) {
            const looked = fresh.get(path)
            if (looked === undefined) {
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
            if (looked.decoded === null) continue
            next.set(path, {
              stamp,
              decoded: looked.decoded,
              fingerprint: looked.fingerprint,
            })
            changed.push(path)
          }
          const removed: Array<string> = []
          for (const path of previous?.keys() ?? []) {
            if (!next.has(path)) removed.push(path)
          }

          yield* Ref.set(cache, next)
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

