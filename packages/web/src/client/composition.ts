/**
 * Two readings because Safari is out of order: `isComposing` is the standard
 * answer, and `keyCode === 229` is what Safari leaves when it delivers the
 * confirming key after `compositionend` has already cleared the flag.
 */
export const composing = (event: KeyboardEvent): boolean =>
  event.isComposing || event.keyCode === 229

export const protectComposition = (): (() => void) => {
  const protect = (event: KeyboardEvent) => {
    if (composing(event)) event.stopPropagation()
  }
  window.addEventListener("keydown", protect, true)
  return () => window.removeEventListener("keydown", protect, true)
}
