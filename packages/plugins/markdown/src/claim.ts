import type { FileClaim } from "@olai/plugin-api/services"
export const name = "markdown"
export const claim: FileClaim = {
  exts: [".md"], holds: "text", kept: true, fetched: false, noun: "document", article: "a",
}
