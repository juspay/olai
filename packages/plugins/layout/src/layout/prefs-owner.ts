import { boolCodec,createPreference } from "@olai/web/client/preference.ts"
import { parsePx,SIDEBAR_DEFAULT_PX,SIDEBAR_MAX_PX,SIDEBAR_MIN_PX,SIDEBAR_OPEN_KEY,SIDEBAR_WIDTH_KEY } from "./prefs.ts"
import { holdLayoutPreferences,publishViewportWidth } from "./live.ts"
export const followLayout = (): (() => void) => {
const sidebarOpenPref = createPreference(SIDEBAR_OPEN_KEY, boolCodec(true))

const sidebarWidthPref = createPreference(SIDEBAR_WIDTH_KEY, {
  parse: (raw) =>
    parsePx(raw, SIDEBAR_DEFAULT_PX, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX),
  print: String,
})


 const detach=holdLayoutPreferences({sidebarOpenPref,sidebarWidthPref})
  const stop = [sidebarOpenPref, sidebarWidthPref].map((preference) => preference.follow())

  // Width is itself reactive. Re-setting unchanged preferences does not notify
  // Solid, and used to leave CSS at the old fit after a window resize.
  const onResize = () => publishViewportWidth(window.innerWidth)
  onResize()
  window.addEventListener("resize", onResize)
  return () => {
    window.removeEventListener("resize", onResize)
    for (const dispose of stop) dispose()
    detach()
  }
}
