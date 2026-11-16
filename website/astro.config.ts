import { satteri } from "@astrojs/markdown-satteri"
import { defineConfig } from "astro/config"

import { docsPage } from "./src/markdown.ts"

export default defineConfig({
  site: "https://olai.page",
  trailingSlash: "always",
  server: { host: "127.0.0.1" },
  markdown: {
    processor: satteri({ mdastPlugins: [docsPage] }),
  },
})
