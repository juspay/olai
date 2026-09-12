import type { FileClaim } from "@olai/plugin-api/services"
export const name = "csv"
export const claim: FileClaim = {
      exts: [".csv"], holds: "text", kept: false, fetched: false,
      noun: "table", article: "a",
    }
