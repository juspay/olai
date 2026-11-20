import { isInstalledFromEnv } from "@kolu/surface-app/solid"

import { grumble } from "@olai/web/client/grumble.ts"

export type Channel = "app" | "tab"

export const channelFor = (badging: boolean, installed: boolean): Channel =>
  badging && installed ? "app" : "tab"

const INSTALLED_MODES = ["standalone", "minimal-ui", "fullscreen"]

export const createBadge = (tabWaiting: (value: boolean) => void) => {
let running: boolean | undefined

const installed = (): boolean => {
  running ??= isInstalledFromEnv({
    isSecureContext: window.isSecureContext,
    displayModeStandalone: INSTALLED_MODES.some(
      (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
    ),
    navigatorStandalone: (navigator as { standalone?: boolean }).standalone === true,
  })
  return running
}

const noBadge = (cause: unknown): void => {
  grumble(
    "app-badge",
    "olai: this browser would not badge the app icon, so the tab's own mark is all there is",
    cause,
  )
}

let worn: number | null = null

return (count: number): void => {
  if (count === worn) return
  worn = count
  const badging = "setAppBadge" in navigator
  if (channelFor(badging, installed()) === "app") {
    const nav = navigator as {
      setAppBadge?: (count?: number) => Promise<void>
      clearAppBadge?: () => Promise<void>
    }
    const asked = count > 0 ? nav.setAppBadge?.(count) : nav.clearAppBadge?.()
    void asked?.catch(noBadge)
    return
  }
  tabWaiting(count > 0)
}

}
