import path from "node:path"

import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"

import { DOCS, idOf } from "./markdown.ts"

/** Every page under `website/docs/`; a plugin's page is a symlink there onto
 *  the `docs.md` beside its code. */
const docs = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: DOCS,
    generateId: ({ entry }) => idOf(path.join(DOCS, entry)),
  }),
})

export const collections = { docs }
