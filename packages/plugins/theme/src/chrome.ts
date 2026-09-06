/** Browser metadata belongs to one appearance activation. Other plugins use
 * the appearance service; no mutable DOM cache exists at module scope. */
import { markSvg } from "@olai/appearance/mark.ts"
import type { Palette } from "@olai/appearance/palettes.ts"

export const createChrome = () => {
  const previousTitle = document.title
  const previousMeta = document.querySelector('meta[name="theme-color"]')
  const previousColor = previousMeta?.getAttribute("content") ?? null
  const previousIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  const previousHref = previousIcon?.getAttribute("href") ?? null
  const previousApple = document.querySelector('meta[name="apple-mobile-web-app-title"]')
  const previousAppleName = previousApple?.getAttribute("content") ?? null
  let meta = previousMeta
  let icon = previousIcon
  let apple = previousApple
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
      meta ??= document.head.appendChild(Object.assign(document.createElement("meta"), { name: "theme-color" }))
      meta.setAttribute("content", palette.colors.paper)
      paintIcon(palette)
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
      restore(previousMeta, meta, "content", previousColor)
      restore(previousIcon, icon, "href", previousHref)
      restore(previousApple, apple, "content", previousAppleName)
      if (iconUrl !== undefined) URL.revokeObjectURL(iconUrl)
      iconUrl = undefined
      shown = undefined
    },
  }
}
