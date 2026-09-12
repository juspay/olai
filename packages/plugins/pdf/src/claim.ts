import type { FileClaim } from "@olai/plugin-api/services"
export const name = "pdf"
export const claim: FileClaim = {
      exts: [".pdf"], holds: "bytes", kept: false, fetched: true,
      noun: "PDF", article: "a",
    }
