/**
 * A MOUNT THAT HAS TO WAIT FOR A CHUNK — and the one shape in which its cleanup
 * is actually registered.
 *
 * ## The bug this is the name of
 *
 * `onMount(async () => { await import(…); …; onCleanup(…) })` reads exactly
 * right and installs nothing. Solid restores `Owner` in the `finally` of the
 * computation it ran the body in, and an `async` body RETURNS at its first
 * `await` — so everything after it runs on a later microtask with `Owner ===
 * null`, where `onCleanup` is this:
 *
 * ```js
 * function onCleanup(fn) {
 *   if (Owner === null) ; else if (…) …
 * }
 * ```
 *
 * An empty statement in the production build. Not a warning, not a throw, and
 * not a race: `await` always yields, so the cleanup is ALWAYS dropped and the
 * pane's terminal and its `ResizeObserver` were never released, on every close,
 * in every browser.
 *
 * ## Why `runWithOwner` is not the answer
 *
 * The obvious rescue — capture `getOwner()` before the await and re-enter it
 * after — closes the common case and leaves the worse one. `onCleanup` inside a
 * DISPOSED owner is a no-op too (it pushes onto a `cleanups` array nothing will
 * read again), and the whole reason for the dynamic import is that the first
 * open pays a network fetch: closing the pane while the chunk is in flight is
 * the case with the longest window and no cleanup at all.
 *
 * ## So: register first, guard after
 *
 * The cleanup goes in SYNCHRONOUSLY, while the frame is still owned, and names
 * a slot rather than a value — there is nothing to release yet. The
 * continuation then asks whether it still has a reader before it builds
 * anything. Both closes are covered by construction and neither depends on how
 * fast a chunk arrives.
 */

import { onCleanup, onMount } from "solid-js"

/**
 * Mount something that has to be loaded first.
 *
 * `made` is handed what `load` resolved to and answers with the way to release
 * what it made — so acquisition and release are written in one place and cannot
 * drift apart, which is the same pairing `Effect.acquireRelease` is on the
 * other side of this tree.
 *
 * `failed` is the arm a bare `await` in an `onMount` does not have at all: a
 * chunk that will not fetch is an ordinary thing on a flaky connection, and
 * without this the rejection lands on the console as an unhandled promise and
 * the reader is left looking at an empty box that never says why.
 *
 * NOTHING RUNS AFTER THE OWNER IS GONE. `made` is not called if the owner was
 * disposed while `load` was in flight, `failed` is not called either, and what
 * `made` returned is released exactly once when the owner goes.
 */
export const mountLater = <A>(
  load: () => Promise<A>,
  made: (loaded: A) => () => void,
  failed: (reason: unknown) => void,
): void => {
  onMount(() => {
    let release: (() => void) | undefined
    let closed = false
    // THE WHOLE OF THE REPAIR IS THIS LINE'S POSITION: before any await, inside
    // the owned frame, over a slot that is still empty.
    onCleanup(() => {
      closed = true
      const releasing = release
      release = undefined
      releasing?.()
    })
    void load().then(
      (loaded) => { if (!closed) release = made(loaded) },
      (reason) => { if (!closed) failed(reason) },
    )
  })
}
