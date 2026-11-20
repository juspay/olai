export type Next =
  | {
    readonly kind: "write"
    readonly data: string
    readonly reset: boolean
    readonly grid?: Grid
  }
  | { readonly kind: "reattach"; readonly why: string }
  | { readonly kind: "stop"; readonly says: string }
  | { readonly kind: "idle" }

export const FIRST_FRAME_MS = 4_000

export const ATTEMPT_BUDGET = 6

export interface Attaching {
  readonly attempts: number
  readonly seen: boolean
}

export interface Grid {
  readonly cols: number
  readonly rows: number
}

export const opening = (): Attaching => ({ attempts: 1, seen: false })

export const again = (was: Attaching): Attaching => ({
  attempts: was.attempts + 1,
  seen: false,
})

export const spent = (was: Attaching): boolean => was.attempts >= ATTEMPT_BUDGET

export const onFrame = (
  state: Attaching,
  frame:
    | { readonly kind: "delta"; readonly data: string }
    | {
      readonly kind: "snapshot"
      readonly data: string
      readonly grid?: Grid | null
    }
    | { readonly kind: "refused"; readonly says: string },
): { readonly state: Attaching; readonly next: Next } => {
  if (frame.kind === "refused") {
    return { state, next: { kind: "stop", says: frame.says } }
  }
  const seen = { attempts: 1, seen: true }
  if (frame.kind === "delta") {
    return { state: seen, next: { kind: "write", data: frame.data, reset: false } }
  }
  return {
    state: seen,
    next: {
      kind: "write",
      data: frame.data,
      reset: true,
      grid: frame.grid ?? undefined,
    },
  }
}

export const onEnd = (state: Attaching): Next =>
  spent(state)
    ? {
      kind: "stop",
      says: "This terminal stopped responding. It probably closed.",
    }
    : { kind: "reattach", why: "the stream ended, which is not the same as the terminal ending" }

export const onSilence = (state: Attaching): Next =>
  state.seen
    ? { kind: "idle" }
    : spent(state)
    ? { kind: "stop", says: "This terminal isn't sending anything. It may have closed." }
    : { kind: "reattach", why: "no first frame inside the deadline" }

export const REATTACH_MS = 250
