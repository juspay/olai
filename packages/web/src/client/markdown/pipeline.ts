/**
 * The markdown machinery — and the one module of this app that is NOT in the
 * bundle the first paint waits for.
 *
 * Everything about the pipeline itself is here: the plugins, the order they run
 * in, the grammars a fence may name. ./render.ts is what CALLS it — the memo,
 * the ids, the tree walks — and it holds none of these imports, which is the
 * whole point. `unified` + remark + rehype + `highlight.js`'s common grammars
 * are ~390 KB of the client (~95 KB brotli), and an outline is titles,
 * checkboxes and badges: rows that need a markdown parser only when one of them
 * turns out to have markdown in it.
 *
 * So this file is a CHUNK of its own, and ./chunk.ts's `import("./pipeline.ts")`
 * is the whole of what asks for that: the bundler reads the specifier, splits
 * this graph out of the entry, and hashes it into the same immutable `/assets/`
 * dir (`pipeline-<hash>.js`). The specifier used to be a VARIABLE, deliberately,
 * to defeat a bundler that had splitting hardcoded off and would otherwise have
 * inlined this here — deferred in evaluation, identical on the wire. That is
 * `buildSurfaceClient`'s job now (kolu#2159), so the literal is what does the
 * work.
 *
 * The stages, and why each is where it is:
 *
 *   1. **parse**, with GFM — which is what brings footnotes (and tables, task
 *      lists and strikethrough) into the same dialect an agent and a reader
 *      already write.
 *   2. **to HTML**, with footnote ids left bare (`clobberPrefix: ""`). They are
 *      re-minted by ./render.ts against the block they are in, so a prefix here
 *      would only be a second one to strip.
 *   3. **anchor the headings** — an `id` per heading and a link beside it
 *      pointing at it, which is what makes a section a place a reader can jump
 *      to and hand to somebody else. Before the sanitiser, not after: the id is
 *      made out of a heading somebody WROTE, so what it produces is checked by
 *      the allowlist rather than trusted for having arrived late. ./anchors.ts
 *      is that decision.
 *   4. **sanitise**, which is what makes the result safe to hand to
 *      `innerHTML`: these files are written by people, by agents and by git
 *      merges, and a note is not a place a `<script>` may appear. The allowlist
 *      is ./sanitise.ts — the security boundary, in one file, with everything
 *      this app has ever added to it named there.
 *   5. **highlight**, and then ./render.ts's own walk. Highlighting runs AFTER
 *      the sanitiser deliberately: the `hljs-` spans are ours, produced from
 *      the code's own text, so they need no allowlist entry — while
 *      `language-…` on a `<code>`, which is the reader's, is on the sanitiser's
 *      default allowlist and survives to be read here. The highlighter is
 *      `rehype-highlight`, SHIPPED BY THIS SERVER: it is in `bun.lock`, so
 *      `bun.nix` fetches it into the Nix build, and no page ever asks a CDN for
 *      the code that renders someone's private outline. Being a second file on
 *      this server's own `/assets/` does not change that — it is the same
 *      origin, the same immutable pin, the same bytes CI built.
 *
 * The pipeline is built ONCE, when this module is evaluated — which is now the
 * moment the chunk lands rather than the moment the app starts.
 * `rehype-highlight` registers three dozen languages as it is attached, and a
 * pipeline rebuilt per note would pay for that on every row of every frame.
 */

import nix from "highlight.js/lib/languages/nix"
import { common } from "lowlight"
import rehypeAutolinkHeadings from "rehype-autolink-headings"
import rehypeHighlight from "rehype-highlight"
import rehypeSanitize from "rehype-sanitize"
import rehypeStringify from "rehype-stringify"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"
import type { Root } from "hast"

import { AUTOLINK } from "./anchors.ts"
import { SANITISE } from "./sanitise.ts"
import { rehypeSlugs } from "./slugs.ts"

/**
 * The grammars a fence may name: `lowlight`'s common set, plus Nix.
 *
 * Spelled out because the option REPLACES the default rather than adding to
 * it — `rehype-highlight` builds its lowlight from whatever `languages` says,
 * so `{ nix }` alone would be a client that had forgotten TypeScript.
 *
 * Nix is the one addition, and it is not a preference: this repository is
 * built and run through Nix, its own `docs/` are what `just serve` serves with
 * no arguments, and a ```nix fence there came out as grey text while the one
 * above it was coloured. An unregistered language is not an error — the block
 * is drawn as plain text, which is what ./render.test.ts pins — so this is the
 * difference between a fence that reads and one that merely survives.
 */
const languages = { ...common, nix }

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { clobberPrefix: "" })
  .use(rehypeSlugs)
  .use(rehypeAutolinkHeadings, AUTOLINK)
  .use(rehypeSanitize, SANITISE)
  .use(rehypeHighlight, { detect: false, languages })
  .use(rehypeStringify)

/**
 * What the rest of the app is allowed to know about the pipeline: two
 * functions, one each way.
 *
 * Narrow on purpose. This is the shape ./chunk.ts hands out once the file has
 * arrived, so it is also the surface a test installs and the thing a reader
 * has to hold in mind to follow ./render.ts. A `Processor` with its own plugin
 * API would invite a second `.use()` somewhere else, and then the pipeline
 * would be built in two places again.
 */
export interface Pipeline {
  /** Source → the sanitised, highlighted HAST, before anything of ours has
   *  walked it. */
  readonly treeOf: (source: string) => Root
  /** A tree that pipeline ran → the HTML string an element may be given. */
  readonly htmlOf: (tree: Root) => string
}

export const treeOf = (source: string): Root =>
  pipeline.runSync(pipeline.parse(source)) as Root

export const htmlOf = (tree: Root): string => pipeline.stringify(tree)
