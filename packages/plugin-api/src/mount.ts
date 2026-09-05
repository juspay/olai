/** The browser host supplies an element; a renderer owns what lives inside it. */
import { serviceTag } from "@olai/effect-cordis"

export interface BrowserMount {
  readonly element: Element
}
export const BrowserMount = serviceTag<BrowserMount>("browser-mount")
export const BROWSER_BOOT_PATH = "/olai/browser-boot"
