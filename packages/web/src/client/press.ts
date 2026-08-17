/**
 * What a reader meant by a press — the one question every click in this app
 * asks before anything decides what to do about it.
 *
 * FOUR places answer a click now, and none of them may disagree about which
 * clicks are theirs: a `<Link>`, which is a real `<a>` this app draws
 * (`./router.tsx`); a link a reader WROTE, which arrives as markup no component
 * owns (`./router.tsx`'s `followed`); a `#tag` pill, which arrives the same way
 * and filters the page instead of navigating (`./filter/tag.ts`); and — since a
 * previewed `.html` began handing its clicks out — the handler the seal injects
 * into that page (`@olai/surface`'s `seal.ts`).
 *
 * The rule was written once for the first two, in the router, with its own
 * argument for being one spelling — "a rule about what a reader meant by a
 * keypress is not a rule to keep in two heads". The third arrived and made that
 * two heads, so the rule moved out to where none of the three owned it. The
 * FOURTH moved it again, one package up, and for the same reason taken to its
 * end: that caller is TEXT shipped into a frame with no module system, so it
 * cannot import anything at all — and a rule the injected script hand-copied
 * would be the two heads again, in two packages, where drift has no symptom.
 *
 * So the rule itself is `@olai/surface`'s (`press.ts` there), which is the home
 * of a rule two packages that cannot import each other must agree on: this
 * module reads it, and the seal interpolates its source into the script it
 * ships. This file is the DOOR — the client's own name for it, so the three
 * call sites here are unchanged and a reader looking for the rule where it has
 * always been finds it.
 */

import { ours, type Press } from "@olai/surface"

export { ours }

/**
 * Is this press an "open to the right" — Alt+click — and should it force a
 * NEW pane (Alt+Shift+click) or reuse the one already there?
 *
 * `ours` is the rule a modified click is the browser's (a new tab, a
 * download). That rule stays: Ctrl/Cmd+click is still a new tab, because
 * the href is real. Alt is the one modifier this app claims, and it claims
 * it here rather than inside `ours`, so the seal that ships `ours` into a
 * previewed page does not start intercepting a key the frame would have
 * given to the browser.
 *
 * Shift without Alt is still not ours (and not this): a shifted click is
 * not a split.
 */
export type Split = "reuse" | "force"

export const splitClick = (press: Press): Split | null => {
  if (press.defaultPrevented || press.button !== 0) return null
  if (press.metaKey || press.ctrlKey) return null
  if (!press.altKey) return null
  return press.shiftKey ? "force" : "reuse"
}
