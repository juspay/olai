import type { FileClaim } from "@olai/plugin-api/services"
import { format } from "./format.ts"
export const name = "olai"
export const claim: FileClaim = {
      exts: [".olai"], holds: "nodes", kept: true, fetched: false,
      noun: "outline", article: "an", format,
    }
