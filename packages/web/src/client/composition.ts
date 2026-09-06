/** Candidate-selection keys belong to the platform IME. The navigation
 * activation owns this listener, including the legacy confirmation key. */
export const protectComposition = (): (() => void) => {
  const protect = (event: KeyboardEvent) => {
    if (event.isComposing || event.keyCode === 229) event.stopPropagation()
  }
  window.addEventListener("keydown", protect, true)
  return () => window.removeEventListener("keydown", protect, true)
}
