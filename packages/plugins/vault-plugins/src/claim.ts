import type { FileClaim } from "@olai/plugin-api/services"
import { PLUGIN_FOLDER } from "@olai/surface"

export const claim: FileClaim = {
  exts: [".ts", ".tsx"],
  holds: "text",
  kept: true,
  fetched: false,
  noun: "plugin half",
  article: "a",
  under: PLUGIN_FOLDER,
  elsewhere: true,
  opaque: true,
}
