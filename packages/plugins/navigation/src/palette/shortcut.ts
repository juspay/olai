/** Navigation accepts palette intent even before its layout integration mounts. */
import { matchKey } from "@olai/web/client/keys.ts"
import { closePalette, openPalette, paletteOpen } from "./open.ts"

export function followPaletteShortcut(): () => void {
  const key = (event: KeyboardEvent) => {
    if (event.defaultPrevented || matchKey(event)?.action !== "palette") return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (paletteOpen()) closePalette()
    else openPalette()
  }
  window.addEventListener("keydown", key)
  return () => window.removeEventListener("keydown", key)
}
