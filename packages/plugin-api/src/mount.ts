/** The browser host supplies an element; a renderer owns what lives inside it. */
import { serviceTag } from "@olai/effect-cordis"

export interface BrowserMount {
  readonly element: Element
}
export const BrowserMount = serviceTag<BrowserMount>("browser-mount")
export const BROWSER_BOOT_PATH = "/olai/browser-boot"
/** Build-derived URLs, never a selection roster. Used only to retry a module
 * whose original dynamic import was cached as failed by the browser. */
export const BROWSER_MODULES_ID = "olai-browser-modules"
