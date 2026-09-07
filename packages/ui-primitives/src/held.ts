/**
 * A CONSUMER'S OWN HOLD ON A SERVICE IT DECLARED — the shape a browser half
 * uses to get a service from the `apply` that named it down to the component
 * that draws with it.
 *
 * ## The problem it is the answer to
 *
 * A service arrives where the DEPENDENCY is declared, which is a plugin's
 * `apply`. It is spent where the DRAWING is, which is three levels inside a
 * component, in a memo, in a `<For>`. Threading it between the two makes every
 * component's signature a function of what one descendant needs.
 *
 * The shape this tree reached for instead was a module-scope signal in the
 * PROVIDER's own contract door — `holdX` beside a `useX`, exported through a
 * package boundary — and that is the ownership defect the Cordis audit's §2 and
 * §12 are about: the value crosses a package wall through a module variable, so
 * the runtime sees no dependency at all. Nobody is `waiting`, nothing is
 * reported, and a consumer goes on reading a departed provider's value because
 * nothing told it the provider left.
 *
 * ## What this is, and the three rules that make it safe
 *
 * A FACTORY, not a place. Calling it mints one holder; a package calls it once,
 * in a module of its OWN, and that module is private to the package. Two
 * callers get two holders. Nothing here is module scope, so this file is an
 * inert contract by construction rather than by promise.
 *
 *   - **The consumer holds, never the provider.** The value travels as a
 *     declared service; what lives at module scope is the CONSUMER's own copy
 *     of it, installed by the consuming activation and gone with it. A provider
 *     that exported one of these through its door would be back where this
 *     started, which is what `@olai/bundle`'s fence refuses by name.
 *   - **The hold is the activation's, and it clears BY IDENTITY.** The answer
 *     from {@link Held.hold} removes the value it installed and no other, so a
 *     stopped activation whose finalizer runs after a replacement has installed
 *     its own cannot take the replacement's value out from under it. Register
 *     it the way a plugin registers anything —
 *     `Effect.acquireRelease(Effect.sync(() => hold(value)), stop =>
 *     Effect.sync(stop))` — so an `apply` that dies before it reaches the line
 *     has installed nothing.
 *   - **The read is TRACKED and answers the absence.** It is a Solid signal, so
 *     a memo that read `undefined` re-runs when the provider arrives and again
 *     when it leaves. `undefined` is the honest reading of *the service that
 *     carries this is not mounted*, and a consumer draws its own absent arm for
 *     it rather than being handed a stale value that cannot be told apart from
 *     a live one.
 *
 * ## Why it is here and not in `@olai/plugin-api`
 *
 * Because it is Solid. The plugin API's root door is opened by SERVER halves
 * (`definePlugin` is on it), and a runtime `solid-js` import there would put a
 * UI runtime on every composition root's graph — the one thing
 * `@olai/bundle`'s `NOT_ON_A_SERVER` list exists to refuse. This package is
 * browser furniture and already is exactly that: `./cursor.ts` beside it is the
 * same shape, a factory a caller mints its own of.
 */
import { createSignal, type Accessor } from "solid-js"

export interface Held<T> {
  /**
   * Install this activation's value. The answer removes it — and only it, by
   * identity — so it is the `stop` an `Effect.acquireRelease` releases with.
   */
  readonly hold: (value: T) => () => void
  /** ...and the tracked read. `undefined` while nobody is holding, which is a
   *  state a consumer draws rather than a moment it waits through. */
  readonly read: Accessor<T | undefined>
}

export const heldService = <T,>(): Held<T> => {
  // A FUNCTION IN THE SIGNAL, always. Solid treats a stored function as an
  // updater, so a service whose shape IS a function (a provider factory, a
  // reading) would be invoked by the setter rather than stored. The wrapper is
  // what makes this generic over any `T` rather than over the values that
  // happen not to be callable.
  const [held, setHeld] = createSignal<{ readonly value: T } | undefined>()
  return {
    hold: (value) => {
      const own = { value }
      setHeld(own)
      return () => { if (held() === own) setHeld(undefined) }
    },
    read: () => held()?.value,
  }
}
