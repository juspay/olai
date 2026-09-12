import type { FileClaim } from "@olai/plugin-api/services"
export const name = "image"
export const claim: FileClaim = {
  exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg"], holds: "bytes", kept: false, fetched: true,
  picture: true, inert: [".svg"], noun: "image", article: "an",
}
