/**
 * Solid restores `Owner` in the `finally` of the computation it ran the body
 * in, and an `async` body returns at its first `await`, so anything after that
 * await runs with `Owner === null` and `onCleanup` there is a no-op in the
 * production build. `onCleanup` inside an already-disposed owner is a no-op
 * too, so capturing the owner and re-entering it after the await does not help
 * a close that lands while the chunk is in flight.
 */

import { onCleanup, onMount } from "solid-js"

export const mountLater = <A>(
  load: () => Promise<A>,
  made: (loaded: A) => () => void,
  failed: (reason: unknown) => void,
): void => {
  onMount(() => {
    let release: (() => void) | undefined
    let closed = false
    onCleanup(() => {
      closed = true
      const releasing = release
      release = undefined
      releasing?.()
    })
    void load().then(
      (loaded) => {
        if (closed) return
        try {
          release = made(loaded)
        } catch (reason) {
          failed(reason)
        }
      },
      (reason) => { if (!closed) failed(reason) },
    )
  })
}
