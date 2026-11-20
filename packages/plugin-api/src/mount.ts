import { serviceTag } from "@olai/effect-cordis"

export interface BrowserMount {
  readonly element: Element
  /** Host composition can defer notifications until a complete roster commits. */
  readonly changed?: () => void
  readonly reading?: () => void
  /**
   * WHERE EACH PLUGIN SITS IN THE BUILD'S LIST OF ROWS — the order every read
   * of a slot comes back in. A root with no bundle behind it supplies none and
   * `Array.prototype.sort` is stable, so arrival order comes back.
   */
  readonly rank?: (plugin: string) => number
}
export const BrowserMount = serviceTag<BrowserMount>("browser-mount")
export const BROWSER_BOOT_PATH = "/olai/browser-boot"
/** Build-derived URLs, never a selection roster. Used only to retry a module
 * whose original dynamic import was cached as failed by the browser. */
export const BROWSER_MODULES_ID = "olai-browser-modules"
