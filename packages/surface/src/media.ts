import type { Claims } from "@olai/format"
import { isAsset } from "@olai/format"

export const MEDIA_PREFIX = "/media/"

export const mediaHref = (file: string): string =>
  MEDIA_PREFIX + file.split("/").map(encodeURIComponent).join("/")

export const mediaPath = (url: string): string | null => {
  const cut = url.search(/[?#]/)
  const path = cut === -1 ? url : url.slice(0, cut)
  if (!path.startsWith(MEDIA_PREFIX)) return null

  const segments: Array<string> = []
  for (const raw of path.slice(MEDIA_PREFIX.length).split("/")) {
    let segment: string
    try {
      segment = decodeURIComponent(raw)
    } catch {
      return null
    }
    if (segment === "" || segment === "." || segment === "..") return null
    if (segment.includes("/") || segment.includes("\\") || segment.includes("\0")) {
      return null
    }
    segments.push(segment)
  }

  return segments.join("/")
}

export const mediaTarget = (claims: Claims, url: string): string | null => {
  const file = mediaPath(url)
  return file !== null && isAsset(claims, file) ? file : null
}
