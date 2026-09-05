/** Opening the connection dialog moves focus without the user leaving an editor. */
let taking = false
export const takingOfflineFocus = () => taking
export const withOfflineFocus = (open: () => void): void => {
  taking = true
  try { open() } finally { taking = false }
}
