import type { Result } from "effect"

import type { PlatformFailure } from "./errors.ts"

export interface Since<S> {
  readonly value: S
  readonly changed: ReadonlyArray<string>
  readonly removed: ReadonlyArray<string>
}

export interface Codec<F, S, E> {
  readonly match: (path: string) => boolean
  readonly decode: (path: string, contents: string) => Result.Result<F, E>
  readonly byName?: (path: string) => Result.Result<F, E> | null
  /** NO ORDER IS PROMISED. A codec whose answer has an order imposes that order itself. */
  readonly validate: (
    files: ReadonlyMap<string, Result.Result<F, E>>,
    since?: Since<S>,
  ) => Result.Result<S, E>

  readonly unreadable: (failure: PlatformFailure) => E
  readonly stopping?: (
    outcome: Result.Result<S, E>,
    paths: ReadonlyArray<string>,
    standing: S,
  ) => E | null
  readonly unread?: (failure: PlatformFailure) => Result.Result<F, E>
}
