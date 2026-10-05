/** Literal ops test membership. Only the codec comes from its owning row;
 * no plugin testlib supplies the table or owns these fixtures. */
import { claims } from "@olai/format"
import { format } from "olai-plugin-outline-olai/format"
export const TEST_CLAIMS = claims([
  { kind: "outline-olai", format, exts: [".olai"], holds: "nodes", kept: true, fetched: false, noun: "outline", article: "an" },
  { kind: "markdown", exts: [".md"], holds: "text", kept: true, fetched: false, noun: "document", article: "a" },
  { kind: "hypertext", exts: [".html"], holds: "text", kept: false, fetched: true, serving: "sealed-frame", noun: "page", article: "a" },
  { kind: "csv", exts: [".csv"], holds: "text", kept: false, fetched: false, noun: "table", article: "a" },
  { kind: "image", exts: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp", ".ico", ".svg"], holds: "bytes", kept: false, fetched: true, picture: true, inert: [".svg"], noun: "image", article: "an" },
  { kind: "pdf", exts: [".pdf"], holds: "bytes", kept: false, fetched: true, noun: "PDF", article: "a" },
])
