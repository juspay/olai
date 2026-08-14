/**
 * What a reader meant by a press — the one question every click in this app
 * asks before anything decides what to do about it.
 *
 * THREE places answer a click here, and none of them may disagree about which
 * clicks are theirs: a `<Link>`, which is a real `<a>` this app draws
 * (`./router.tsx`); a link a reader WROTE, which arrives as markup no component
 * owns (`./router.tsx`'s `followed`); and a `#tag` pill, which arrives the same
 * way and filters the page instead of navigating (`./filter/tag.ts`).
 *
 * The rule was written once for the first two, in the router, with its own
 * argument for being one spelling — "a rule about what a reader meant by a
 * keypress is not a rule to keep in two heads". The third arrived and made that
 * two heads, so the rule moved out to where none of the three owns it: the
 * router owns the ADDRESS, and the filter owns what NARROWS a page, and neither
 * of them owns the mouse.
 *
 * It is the whole of what a modifier means in this client. A modified click is
 * a reader asking for the browser's own behaviour — a new tab, a download, a
 * save — and is never ours to intercept; a click something deeper already
 * answered has been answered, which is how a `<Link>` inside a pane with its
 * own listener keeps its own route, and how a tag inside a breadcrumb goes on
 * navigating.
 */

/** Is this click one this app may answer in place? */
export const ours = (event: MouseEvent): boolean =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
