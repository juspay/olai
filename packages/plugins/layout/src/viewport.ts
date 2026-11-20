/**
 * `interactive-widget=resizes-content` (index.html) would make this
 * unnecessary, but iOS ignores it: there an on-screen keyboard covers the
 * bottom of the layout viewport without shrinking it.
 */

export interface VisibleViewport {
  readonly height: number
  readonly bottom: number
}

/** `clientHeight` rather than `innerHeight` for the layout viewport: a fixed
 *  box is placed in the one that has no room for a scrollbar either, and
 *  `visualViewport` does not count them. Rounded because a sub-pixel
 *  difference in CSS is a style recalc that moves nothing. */
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

const HEIGHT = "--visible-h"
const BOTTOM = "--visible-bottom"

export const trackVisibleViewport = (): (() => void) => {
  const visual = window.visualViewport
  if (visual == null) return () => {}

  const style = document.documentElement.style
  const previous = [HEIGHT, BOTTOM].map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)] as const)
  // Both properties INHERIT, so writing one is a style recalc for every node on
  // the page: an unchanged reading is not published.
  let height: number | undefined
  let bottom: number | undefined

  // `clientHeight` forces layout, so the layout viewport is re-read only when
  // something could have changed it — never per scroll frame.
  let layout = document.documentElement.clientHeight

  const publish = (): void => {
    const now = visibleViewport(visual, layout)
    if (now.height === height && now.bottom === bottom) return
    height = now.height
    bottom = now.bottom
    style.setProperty(HEIGHT, `${now.height}px`)
    style.setProperty(BOTTOM, `${now.bottom}px`)
  }

  publish()
  const resize = () => {
    layout = document.documentElement.clientHeight
    publish()
  }
  visual.addEventListener("resize", resize)
  visual.addEventListener("scroll", publish)
  return () => {
    visual.removeEventListener("resize", resize)
    visual.removeEventListener("scroll", publish)
    for (const [name, value, priority] of previous) {
      if (value) style.setProperty(name, value, priority)
      else style.removeProperty(name)
    }
  }
}
