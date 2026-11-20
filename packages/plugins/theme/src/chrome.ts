import { markSvg } from "@olai/appearance/mark.ts"
import { SYSTEM_SCHEME } from "@olai/appearance/palettes.ts"
import type { Palette, Scheme } from "@olai/appearance/palettes.ts"

export const createChrome = () => {
  const previousTitle = document.title
  /**
   * EVERY `theme-color` meta, not the first one: the browser paints from the
   * first meta whose `prefers-color-scheme` media matches, and the shell ships
   * one per scheme (`@olai/appearance/shell.ts`). The media attributes are left as the
   * shell authored them, so withdrawal hands that story back intact.
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
      if (colors.length === 0) colors = [document.head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }))]
      for (const element of colors) element.setAttribute("content", palette.colors.paper)
      paintIcon(palette)
    },
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
      restore(previousCanvas, canvas, "content", previousScheme)
      if (iconUrl !== undefined) URL.revokeObjectURL(iconUrl)
      iconUrl = undefined
      shown = undefined
    },
  }
}
