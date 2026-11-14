/** Browser metadata belongs to one appearance activation. Other plugins use
 * the appearance service; no mutable DOM cache exists at module scope. */
import { markSvg } from "@olai/appearance/mark.ts"
import { SYSTEM_SCHEME } from "@olai/appearance/palettes.ts"
import type { Palette, Scheme } from "@olai/appearance/palettes.ts"

export const createChrome = () => {
  const previousTitle = document.title
  /**
   * EVERY `theme-color` meta, not the first one.
   *
   * The shell ships two, each qualified by a `prefers-color-scheme` media
   * query, because before the bundle is up the only thing it can know is
   * which default the OS would choose (theme/head.html). Once a palette is in
   * force that question is answered: the page is ONE colour whatever the OS
   * says, and the browser picks the first meta whose media matches — which,
   * for a dark palette under a light OS, is the one this code used to leave
   * alone. An installed `abyss` window wore the dark default's paper instead
   * of its own.
   *
   * So the pick is written into both of them, and the media attributes are
   * left exactly as the shell authored them: the qualifiers are the SHELL's
   * story about a page nobody has picked on, and withdrawal has to hand that
   * story back intact. Two metas agreeing is not a contradiction — it is the
   * page saying the same thing under either scheme, which is what a pick is.
   */
  const previousColors = Array.from(document.querySelectorAll('meta[name="theme-color"]'))
    .map((element) => ({ element, content: element.getAttribute("content") }))
  const previousIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  const previousHref = previousIcon?.getAttribute("href") ?? null
  const previousApple = document.querySelector('meta[name="apple-mobile-web-app-title"]')
  const previousAppleName = previousApple?.getAttribute("content") ?? null
  const previousCanvas = document.querySelector('meta[name="color-scheme"]')
  const previousScheme = previousCanvas?.getAttribute("content") ?? null
  let colors = previousColors.map((previous) => previous.element)
  let icon = previousIcon
  let apple = previousApple
  let canvas = previousCanvas
  let iconUrl: string | undefined
  let shown: Palette | undefined
  let waiting = false
  let name = previousTitle
  let active = true
  const check = () => {
    if (!active) throw new Error("The appearance provider is no longer active")
  }
  const paintTitle = () => { document.title = waiting ? `● ${name}` : name }
  const paintIcon = (palette: Palette) => {
    const url = URL.createObjectURL(new Blob([markSvg(palette, waiting)], { type: "image/svg+xml" }))
    try {
      icon ??= document.head.appendChild(Object.assign(document.createElement("link"), { rel: "icon", type: "image/svg+xml" }))
      icon.href = url
    } catch (error) {
      URL.revokeObjectURL(url)
      throw error
    }
    const previous = iconUrl
    iconUrl = url
    if (previous !== undefined) URL.revokeObjectURL(previous)
  }
  const restore = (previous: Element | null, current: Element | null, attribute: string, value: string | null) => {
    if (previous === null) current?.remove()
    else if (value === null) previous.removeAttribute(attribute)
    else previous.setAttribute(attribute, value)
  }
  return {
    paint: (palette: Palette) => {
      check()
      shown = palette
      // A shell that shipped none — a host page, a test's own document — gets
      // one unqualified meta, which is the same claim with nothing to qualify.
      if (colors.length === 0) colors = [document.head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }))]
      for (const element of colors) element.setAttribute("content", palette.colors.paper)
      paintIcon(palette)
    },
    /**
     * WHICH WAY THE BROWSER'S OWN SURFACES GO — the canvas behind the page,
     * the scrollbars, the form controls. The sheet already says this per
     * palette, and for a page that is being looked at the sheet is what wins;
     * what the meta owns is the NEXT load, where the shell's boot script
     * copies the stored word onto this same element before any CSS exists
     * (theme/head.html). So this write is less a repaint than the pick being
     * recorded where the pre-sheet window can read it.
     *
     * `undefined` is the page that has handed the question back: the authored
     * default goes in, because "follow the OS" is a thing to SAY and not the
     * absence of one — a meta left on `dark` would pin a page nobody picked.
     */
    scheme: (value: Scheme | undefined) => {
      check()
      canvas ??= document.head.appendChild(Object.assign(document.createElement("meta"), { name: "color-scheme" }))
      canvas.setAttribute("content", value ?? SYSTEM_SCHEME)
    },
    waiting: (value: boolean) => {
      check()
      if (value === waiting) return
      waiting = value
      paintTitle()
      if (shown !== undefined) paintIcon(shown)
    },
    name: (called: string | undefined) => {
      check()
      name = called ?? previousTitle
      paintTitle()
      if (called === undefined) {
        restore(previousApple, apple, "content", previousAppleName)
        apple = previousApple
        return
      }
      apple ??= document.head.appendChild(Object.assign(document.createElement("meta"), { name: "apple-mobile-web-app-title" }))
      apple.setAttribute("content", called)
    },
    close: () => {
      if (!active) return
      active = false
      document.title = previousTitle
      if (previousColors.length === 0) for (const element of colors) element.remove()
      else for (const previous of previousColors) restore(previous.element, previous.element, "content", previous.content)
      restore(previousIcon, icon, "href", previousHref)
      restore(previousApple, apple, "content", previousAppleName)
      // What it INHERITED, which on a page that was loaded with a pick is the
      // word the boot script put there — withdrawal leaves the page as it was
      // found, not as the shell was authored.
      restore(previousCanvas, canvas, "content", previousScheme)
      if (iconUrl !== undefined) URL.revokeObjectURL(iconUrl)
      iconUrl = undefined
      shown = undefined
    },
  }
}
