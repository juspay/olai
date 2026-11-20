import { Effect } from "effect"

import { type Disk, sameStamp, type Stamp } from "./disk.ts"
import type { PlatformFailure } from "./errors.ts"

export type Freshness = "cheap" | "verified"

export interface Vintage {
  readonly provedAt: number
  readonly age: number
  readonly proof: Proof
}

export type Proof = Held | Confirmed | Diverged | Unchecked

export interface Held {
  readonly _tag: "Held"
}

export interface Confirmed {
  readonly _tag: "Confirmed"
}

export interface Diverged {
  readonly _tag: "Diverged"
  readonly paths: ReadonlyArray<string>
}

export interface Unchecked {
  readonly _tag: "Unchecked"
  readonly why: string
}

export const HELD: Held = { _tag: "Held" }
export const CONFIRMED: Confirmed = { _tag: "Confirmed" }

export interface Standing {
  readonly provedAt: number
  readonly stamps: ReadonlyMap<string, Stamp>
}

export const nothingProved = (at: number): Standing => ({ provedAt: at, stamps: new Map() })

export const check = (
  disk: Disk,
  match: (path: string) => boolean,
  standing: Standing,
): Effect.Effect<Proof> =>
  Effect.match(disk.listingOnly(match), {
    onFailure: (failure: PlatformFailure): Proof => ({
      _tag: "Unchecked",
      why: failure.message,
    }),
    onSuccess: (found): Proof => {
      const paths = divergence(found, standing.stamps)
      return paths.length === 0 ? CONFIRMED : { _tag: "Diverged", paths }
    },
  })

export const divergence = (
  found: ReadonlyMap<string, Stamp>,
  expected: ReadonlyMap<string, Stamp>,
): ReadonlyArray<string> => {
  const paths: Array<string> = []
  for (const [path, stamp] of found) {
    const was = expected.get(path)
    if (was === undefined || !sameStamp(was, stamp)) paths.push(path)
  }
  for (const path of expected.keys()) {
    if (!found.has(path)) paths.push(path)
  }
  return paths.sort()
}

export const vintageOf = (standing: Standing, now: number, proof: Proof): Vintage => ({
  provedAt: proof._tag === "Confirmed" ? now : standing.provedAt,
  age: proof._tag === "Confirmed" ? 0 : Math.max(0, now - standing.provedAt),
  proof,
})

export const isStale = (vintage: Vintage): boolean =>
  vintage.proof._tag === "Diverged" || vintage.proof._tag === "Unchecked"
