import { WORKSPACE_PREFIX } from "./workspace.ts"

export const legacyZoomHref = (href: string): string => {
  if (/^\/(?:\?[^#]*)?#.+/.test(href)) return "/zoom/" + href.slice(1)
  if (!href.startsWith(WORKSPACE_PREFIX)) return href
  const query = href.indexOf("?")
  const path = query < 0 ? href : href.slice(0, query)
  try {
    return WORKSPACE_PREFIX + path.slice(WORKSPACE_PREFIX.length).split("/").map(part =>
      encodeURIComponent(legacyZoomHref("/" + decodeURIComponent(part)).slice(1))).join("/") + (query < 0 ? "" : href.slice(query))
  } catch { return href }
}
