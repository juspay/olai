import { boolCodec,createPreference } from "@olai/web/client/preference.ts"
import { CHAT_DEFAULT_PX,holdLayoutPreferences,PANEL_MAX_PX,PANEL_MIN_PX,PANEL_OPEN_KEY,PANEL_SNAP_KEY,PANEL_WIDTH_KEY,parsePx,parseSnap,publishViewportWidth,SIDEBAR_DEFAULT_PX,SIDEBAR_MAX_PX,SIDEBAR_MIN_PX,SIDEBAR_OPEN_KEY,SIDEBAR_WIDTH_KEY } from "./prefs.ts"
export const followLayout = (): (() => void) => {
const sidebarOpenPref = createPreference(SIDEBAR_OPEN_KEY, boolCodec(true))

const sidebarWidthPref = createPreference(SIDEBAR_WIDTH_KEY, {
  parse: (raw) =>
    parsePx(raw, SIDEBAR_DEFAULT_PX, SIDEBAR_MIN_PX, SIDEBAR_MAX_PX),
  print: String,
})

const panelOpenPref = createPreference(PANEL_OPEN_KEY, boolCodec(false))

const panelWidthPref = createPreference(PANEL_WIDTH_KEY, {
  parse: (raw) => parsePx(raw, CHAT_DEFAULT_PX, PANEL_MIN_PX, PANEL_MAX_PX),
  print: String,
})

const panelSnapPref = createPreference(PANEL_SNAP_KEY, {
  parse: parseSnap,
  print: (snap) => snap,
})


 const detach=holdLayoutPreferences({sidebarOpenPref,sidebarWidthPref,panelOpenPref,panelWidthPref,panelSnapPref})
  const stop = [sidebarOpenPref, sidebarWidthPref, panelOpenPref, panelWidthPref, panelSnapPref].map((preference) => preference.follow())

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
