import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"

/** Every page under `website/docs/`; a plugin's page is a symlink there onto
 *  the `docs.md` beside its code. The id is the path without `.md`. */
const docs = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: "./docs",
    generateId: ({ entry }) => entry.replace(/\.md$/, ""),
  }),
})

export const collections = { docs }
