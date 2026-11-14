/**
 * IS THIS KEYSTROKE THE PLATFORM IME'S? Two readings, because one engine is
 * out of order: `isComposing` is the standard answer, and `keyCode === 229`
 * is the one Safari leaves, which delivers the confirming key AFTER
 * `compositionend` has already cleared the flag. Written once so the pair
 * cannot be half-spelled; `./claims.test.ts` sweeps who asks.
 */
export const composing = (event: KeyboardEvent): boolean =>
  event.isComposing || event.keyCode === 229

/** Candidate-selection keys belong to the platform IME. The navigation
 * activation owns this listener, including the legacy confirmation key. */
export const protectComposition = (): (() => void) => {
  const protect = (event: KeyboardEvent) => {
    if (composing(event)) event.stopPropagation()
  }
  window.addEventListener("keydown", protect, true)
  return () => window.removeEventListener("keydown", protect, true)
}
