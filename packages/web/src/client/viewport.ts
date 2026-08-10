/**
 * How much of the page the reader can actually SEE, published as two custom
 * properties.
 *
 * On a phone the viewport a page is laid out in is not the strip the browser
 * is showing: an on-screen keyboard covers the bottom of it without shrinking
 * it, and a sliding address bar moves it about. `interactive-widget=
 * resizes-content` (index.html) tells a browser to shrink the layout viewport
 * instead, and where it is honoured nothing here is needed — but iOS ignores
 * it, so the reading has to be taken.
 *
 *   --visible-h        how tall the visible strip is
 *   --visible-bottom   how much is hidden BELOW it
 *
 * Both are what a fixed box needs to stay on screen: `--visible-bottom` is the
 * distance a bottom-anchored thing must be lifted by to clear the keyboard,
 * and `--visible-h` is the height a full-height sheet may have. The connection
 * dot is lifted by the first today (connection/Indicator.tsx); the chat panel,
 * which is the reason the second exists in the racket original, arrives with
 * the chat sheet and reads it the same way.
 *
 * The measurement is a plain function of two numbers, so the arithmetic — the
 * part that is easy to get subtly wrong, and that the racket original had a
 * comment about — is testable without a browser. Everything DOM-shaped is the
 * thin subscription below it.
 */

export interface VisibleViewport {
  /** The visible strip's height, in CSS pixels. */
  readonly height: number
  /** How much of the layout viewport is hidden below the visible strip: the
   *  keyboard, or the browser chrome that overlaps it. Never negative — an
   *  over-scrolled page can put the visible strip past the bottom of the
   *  layout one, and a negative offset would pull a fixed box off screen. */
  readonly bottom: number
}

/** What the two properties should say, given the visual viewport's reading and
 *  the layout viewport's height.
 *
 *  `clientHeight` rather than `innerHeight` for the layout viewport: a fixed
 *  box is placed in the one that has no room for a scrollbar either, and
 *  `visualViewport` does not count them. Rounded because these end up in CSS
 *  and a sub-pixel difference is a style recalc for the whole document that
 *  moves nothing. */
export const visibleViewport = (
  visual: { readonly height: number; readonly offsetTop: number },
  layoutHeight: number,
): VisibleViewport => ({
  height: Math.round(visual.height),
  bottom: Math.max(
    0,
    Math.round(layoutHeight - visual.height - visual.offsetTop),
  ),
})

/** The custom property names, spelled once — the stylesheet's side of this is
 *  `var(--visible-bottom)` in whichever component is anchored to the bottom. */
const HEIGHT = "--visible-h"
const BOTTOM = "--visible-bottom"

/**
 * Track the visible viewport for as long as the page lives, publishing it on
 * the document element.
 *
 * Returns a teardown, and a browser that has no `visualViewport` gets a no-op:
 * the properties are then simply unset, and every reader of them supplies its
 * own fallback (`var(--visible-bottom, 0px)`) — which is also the state of the
 * very first paint, before this has run.
 */
export const trackVisibleViewport = (): (() => void) => {
  const visual = window.visualViewport
  if (visual == null) return () => {}

  const style = document.documentElement.style
  // Both properties INHERIT, so writing one costs every node on the page a
  // style recalc — and this fires on every frame of a keyboard sliding up and
  // of an address bar sliding away, most of which move nothing. So the last
  // published reading is kept, and an unchanged one is dropped here.
  let published: VisibleViewport | undefined

  const measure = (): void => {
    const now = visibleViewport(visual, document.documentElement.clientHeight)
    if (
      published !== undefined &&
      published.height === now.height &&
      published.bottom === now.bottom
    ) {
      return
    }
    published = now
    style.setProperty(HEIGHT, `${now.height}px`)
    style.setProperty(BOTTOM, `${now.bottom}px`)
  }

  measure()
  visual.addEventListener("resize", measure)
  // A page scrolled while the keyboard is up moves the visible strip without
  // resizing it, which changes `offsetTop` and nothing else.
  visual.addEventListener("scroll", measure)
  return () => {
    visual.removeEventListener("resize", measure)
    visual.removeEventListener("scroll", measure)
  }
}
