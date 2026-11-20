import { satteri } from "@astrojs/markdown-satteri"
import { defineConfig } from "astro/config"

import { docsPage } from "./src/markdown.ts"

export default defineConfig({
  site: "https://olai.page",
  trailingSlash: "always",
  server: { host: "127.0.0.1" },
  // Vite refuses a request whose Host it does not know, and a proxy in front
  // of the dev server (`tailscale serve`) sends one. Everything here is public.
  vite: { server: { allowedHosts: true } },
  // The home page is hand-written HTML whose line breaks fall between a word
  // and a link; compressing drops that space and runs the two together.
  compressHTML: false,
  markdown: {
    processor: satteri({ mdastPlugins: [docsPage] }),
  },
})
