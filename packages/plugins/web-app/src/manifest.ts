import type { ManifestOptions } from "@kolu/surface-app/server"
import { appName } from "@olai/surface"

export const manifestOf = (hostname: string): ManifestOptions => ({
  name: appName(hostname),
  short_name: hostname,
  description: "Self-hosted outliner: your files, your agent, a live web view.",
  themeColor: "#FBFBF9",
  backgroundColor: "#FBFBF9",
  lang: "en",
  categories: ["productivity", "utilities"],
  icons: [
    { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "/icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
})
