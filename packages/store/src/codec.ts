import type { Result } from "effect"

import type { PlatformFailure } from "./errors.ts"

export interface Since<S> {
  readonly value: S
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

export interface StopCheck<S, E> {
  readonly candidateOutcome: Result.Result<S, E>
  readonly writtenPaths: ReadonlyArray<string>
  readonly standingValue: S
}

export interface Codec<F, S, E> {
  readonly match: (path: string) => boolean
  readonly decode: (path: string, contents: string) => Result.Result<F, E>
  readonly byName?: (path: string) => Result.Result<F, E> | null
  readonly validate: (
    files: ReadonlyMap<string, Result.Result<F, E>>,
    since?: Since<S>,
  ) => Result.Result<S, E>

  readonly unreadable: (failure: PlatformFailure) => E
  readonly stopping?: (check: StopCheck<S, E>) => E | null
  readonly unread?: (failure: PlatformFailure) => Result.Result<F, E>
}
