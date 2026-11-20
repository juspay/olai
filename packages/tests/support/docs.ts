import * as fs from "node:fs"
import * as path from "node:path"

import { type MarkdownNode, mdastOf } from "@olai/markdown-ui/pipeline.ts"

import { ROOT } from "./sweep.ts"

export const VAULT = "website/docs"

export const INDEX = "website/docs/index.md"

export const at = (file: string): string => path.join(ROOT, file)

export const authored = (name: string): string =>
  path.join("packages", "plugins", name, "docs.md")

export const served = (name: string): string => path.join(VAULT, `plugins`, `${name}.md`)

export const pages = (): ReadonlyArray<string> => {
  const walk = (dir: string): ReadonlyArray<string> =>
    fs.readdirSync(at(dir), { withFileTypes: true }).flatMap((entry) => {
      const here = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(here)
      return entry.name.endsWith(".md") ? [here] : []
    })
  return [...walk(VAULT)].sort()
}

export const linksIn = (file: string): ReadonlyArray<string> => targets(file, "link")

export const picturesIn = (file: string): ReadonlyArray<string> => targets(file, "image")

const targets = (file: string, kind: string): ReadonlyArray<string> => {
  const found: string[] = []
  const walk = (node: MarkdownNode): void => {
    if (node.type === kind && node.url !== undefined) found.push(node.url)
    for (const child of node.children ?? []) walk(child)
  }
  walk(mdastOf(fs.readFileSync(at(file), "utf8")))
  return found
}

export const isLocal = (target: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("#") && !target.startsWith("/")

export const landing = (from: string, target: string): string | null => {
  const address = target.split("#")[0]
  if (address === undefined || address === "") return null
  const landed = path.normalize(path.join(path.dirname(from), address))
  return landed === VAULT || landed.startsWith(`${VAULT}${path.sep}`) ? landed : null
}
