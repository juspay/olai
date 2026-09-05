/** Candidate-selection keys belong to the platform IME. Keep their native
 * default action, but do not deliver them to Olai's shortcuts and popovers.
 * The legacy 229 code also covers browsers whose final confirmation key no
 * longer reports isComposing. Installed once for the lifetime of the page. */
export const protectComposition = (): void => {
  window.addEventListener("keydown", (event) => {
    if (event.isComposing || event.keyCode === 229) event.stopPropagation()
  }, true)
}
