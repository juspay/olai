/** Literal leaf test data; format registration is tested through real rows above this layer. */
import { claims } from "./kinds.ts"
export const NO_CLAIMS = claims([])
export const TEST_CLAIMS = claims([
  { kind: "outline-olai", exts: [".olai"], holds: "nodes", kept: true, fetched: false, noun: "outline", article: "an" },
  { kind: "markdown", exts: [".md"], holds: "text", kept: true, fetched: false, noun: "document", article: "a" },
  { kind: "hypertext", exts: [".html"], holds: "text", kept: false, fetched: true, serving: "sealed-frame", noun: "page", article: "a" },
  { kind: "csv", exts: [".csv"], holds: "text", kept: false, fetched: false, noun: "table", article: "a" },
  { kind: "image", exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg"], holds: "bytes", kept: false, fetched: true, picture: true, inert: [".svg"], noun: "image", article: "an" },
  { kind: "pdf", exts: [".pdf"], holds: "bytes", kept: false, fetched: true, noun: "PDF", article: "a" },
])
