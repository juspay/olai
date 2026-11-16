/**
 * The served set of documentation pages, and the links on them.
 *
 * `just serve` with no argument serves `docs/` as a vault, so a page's links
 * are read from its SERVED address and a target outside `docs/` is not a door
 * at all — it draws as text. Two sweeps need that rule: `../plugin_docs.test.ts`
 * (every plugin has a page, and the index opens it) and `../docs_lint.test.ts`
 * (every page is held to the writing standard). It is spelled here once so the
 * two cannot drift about what a page is or where a link lands.
 */

import * as fs from "node:fs"
import * as path from "node:path"

import { type MarkdownNode, mdastOf } from "@olai/markdown-ui/pipeline.ts"

import { ROOT } from "./sweep.ts"

/** The docs vault's own root — what `just serve` serves with no argument, and
 *  the boundary a served link may not leave. */
export const VAULT = "docs"

/** The page every other page is reached from. */
export const INDEX = "docs/index.md"

/** A repository-relative path, as an absolute one. */
export const at = (file: string): string => path.join(ROOT, file)

/** Where a plugin's page is AUTHORED: beside the code it describes. */
export const authored = (name: string): string =>
  path.join("packages", "plugins", name, "docs.md")

/** Where that same file is SERVED, and therefore where its links are read
 *  from. */
export const served = (name: string): string => path.join(VAULT, `plugins`, `${name}.md`)

/**
 * Every page of the served set, as its served address. The plugin pages are
 * symlinks onto the files under `packages/plugins/`, so reading them here
 * reads one file by its served name — which is the name a reader sees and the
 * name a link resolves against.
 */
export const pages = (): ReadonlyArray<string> => {
  const walk = (dir: string): ReadonlyArray<string> =>
    fs.readdirSync(at(dir), { withFileTypes: true }).flatMap((entry) => {
      const here = path.join(dir, entry.name)
      if (entry.isDirectory()) return walk(here)
      return entry.name.endsWith(".md") ? [here] : []
    })
  return [...walk(VAULT)].sort()
}

/** Every link target on a page, as written in `[label](target)` — fragment
 *  included, and read off the parsed page rather than its characters, so a
 *  `![](art/shot.png)` quoted inside a code span is not mistaken for a link
 *  the page offers. */
export const linksIn = (file: string): ReadonlyArray<string> => targets(file, "link")

/** Every picture a page draws, by the same reading. */
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

/** A link that names a file in the served set — not a URL, not a bare anchor
 *  into the page it is written on, and not an address of the running app
 *  (`/agenda`), which is a route rather than a file. */
export const isLocal = (target: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("#") && !target.startsWith("/")

/** Where a link lands, read from the page's SERVED address, as a
 *  repository-relative path — `null` for one that climbs out of the vault,
 *  which is not a door: an unserved path draws as text. */
export const landing = (from: string, target: string): string | null => {
  const address = target.split("#")[0]
  if (address === undefined || address === "") return null
  const landed = path.normalize(path.join(path.dirname(from), address))
  return landed === VAULT || landed.startsWith(`${VAULT}${path.sep}`) ? landed : null
}
