import { satteri } from "@astrojs/markdown-satteri"
import { defineConfig } from "astro/config"

import { docsPage } from "./src/markdown.ts"

export default defineConfig({
  site: "https://olai.page",
  trailingSlash: "always",
  server: { host: "127.0.0.1" },
  // The home page is hand-written HTML whose line breaks fall between a word
  // and a link; compressing drops that space and runs the two together.
  compressHTML: false,
  markdown: {
    processor: satteri({ mdastPlugins: [docsPage] }),
  },
})
