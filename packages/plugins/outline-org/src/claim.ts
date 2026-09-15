import type { FileClaim } from "@olai/plugin-api/services"
import { format } from "./format.ts"
export const name = "outline-org"
export const claim: FileClaim = {
  exts: [".org"], holds: "nodes", kept: true, fetched: false,
  noun: "outline", article: "an", format,
}
