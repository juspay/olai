import type { FileClaim } from "@olai/plugin-api/services"
export const name = "hypertext"
export const claim: FileClaim = {
  exts: [".html"], holds: "text", kept: false, fetched: true,
  serving: "sealed-frame", noun: "page", article: "a",
}
