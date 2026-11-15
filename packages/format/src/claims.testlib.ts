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
  // THE ONE SCOPED CLAIM in the tree, here so every reader benched against
  // this table is benched against a claim that is NOT just a suffix: `.ts`
  // under `plugins/` is a plugin's half, and `.ts` anywhere else in a vault is
  // somebody's checkout and nothing olai holds (`./kinds.ts`'s `Claim.under`).
  { kind: "vault-plugins", exts: [".ts", ".tsx"], holds: "text", kept: true, fetched: false, noun: "plugin half", article: "a", under: "plugins/", elsewhere: true },
])
