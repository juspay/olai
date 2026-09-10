/** The browser host supplies an element; a renderer owns what lives inside it. */
import { serviceTag } from "@olai/effect-cordis"

export interface BrowserMount {
  readonly element: Element
  /** Host composition can defer notifications until a complete roster commits. */
  readonly changed?: () => void
  readonly reading?: () => void
  /**
   * WHERE EACH PLUGIN SITS IN THE BUILD'S LIST OF ROWS — the order every read
   * of a slot comes back in.
   *
   * It used to be `@olai/web`'s, imposed in a wrapper around the table
   * (`client/plugins/runtime.ts`'s own `hung`) — which was exact while the tab
   * was the only reader and stopped being exact the moment a PLUGIN read a
   * slot: `Faces.hung` handed back registration order, so a panel drawing six
   * plugins' marks got them in the order two dynamic imports came back in
   * while the shell beside it got the file's order. Two answers to one
   * question, and the wrong one was the one a plugin could reach.
   *
   * So the rank arrives HERE, on the door only the renderer holds, and the
   * facade sorts. A root with no bundle behind it (every bench) supplies none
   * and `Array.prototype.sort` is stable, so arrival order comes back — which
   * is the honest answer for a process with no list to be a position in.
   */
  readonly rank?: (plugin: string) => number
}
export const BrowserMount = serviceTag<BrowserMount>("browser-mount")
export const BROWSER_BOOT_PATH = "/olai/browser-boot"
/** Build-derived URLs, never a selection roster. Used only to retry a module
 * whose original dynamic import was cached as failed by the browser. */
export const BROWSER_MODULES_ID = "olai-browser-modules"
