import path from "node:path"

import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"

import { DOCS, idOf } from "./markdown.ts"

const docs = defineCollection({
  loader: glob({
    pattern: "**/*.md",
    base: DOCS,
    generateId: ({ entry }) => idOf(path.join(DOCS, entry)),
  }),
})

export const collections = { docs }
