import { serviceTag } from "@olai/effect-cordis"

export interface BrowserMount {
  readonly element: Element
  readonly changed?: () => void
  readonly reading?: () => void
  readonly rank?: (plugin: string) => number
}
export const BrowserMount = serviceTag<BrowserMount>("browser-mount")
export const BROWSER_BOOT_PATH = "/olai/browser-boot"
/** A failed dynamic `import()` stays failed in the browser's module map for the
 *  life of the realm (https://html.spec.whatwg.org/multipage/webappapis.html#module-map),
 *  so a retry needs a fresh URL. These are the build's own, never a selection roster. */
export const BROWSER_MODULES_ID = "olai-browser-modules"
