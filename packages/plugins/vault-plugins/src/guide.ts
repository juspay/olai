import { readFileSync } from "node:fs"

export const GUIDE: string = readFileSync(new URL("./guide.md", import.meta.url), "utf8").trim()

export const GUIDE_START = "<!-- guide:start -->"
export const GUIDE_END = "<!-- guide:end -->"
