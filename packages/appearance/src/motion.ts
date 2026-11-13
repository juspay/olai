/**
 * THE SAME POLICY, IN THE OTHER GRAMMAR.
 *
 * `./chrome.css` answers `prefers-reduced-motion` for everything a stylesheet
 * can reach — transitions, animations, and the scrolling CSS owns. A scroll
 * that JavaScript asks for is not one of those: `scrollIntoView` and
 * `scrollTo` take their manner as an ARGUMENT, so the preference has to be
 * read and handed over. This is the one place in the browser that reads it,
 * and `web/src/client/claims.test.ts` keeps it the only one — the second copy
 * of a media query is the one that gets the question wrong, and a smooth
 * scroll nobody asked for is the motion a reader most often means.
 *
 * AT THE MOMENT OF THE SCROLL, never at import. `matchMedia` is a live reading
 * and the preference behind it is a system switch: a module-scope constant
 * would answer with whatever was true when the tab loaded and go on saying it
 * for the rest of the session — which is precisely the reader who turned the
 * setting on half an hour in, because something here was making them ill.
 */

/** Has the reader asked for less movement, right now? */
export const motionIsReduced = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

/** How a scroll this tab asks for should travel: smoothly for a reader who
 *  said nothing, and not at all for one who asked for less motion. The return
 *  is the platform's own `ScrollBehavior`, so a caller passes it straight into
 *  `scrollIntoView` or `scrollTo` and spells no media query of its own. */
export const scrollManner = (): ScrollBehavior => (motionIsReduced() ? "auto" : "smooth")
