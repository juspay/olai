/**
 * OUR RULE FOR WHERE THE `---` BLOCK ENDS, held against the ECOSYSTEM'S.
 *
 * `@olai/format`'s `proseIn` is the one authority in this app: the face reads
 * past the block with it and the three faces that draw a whole file strip it
 * with the same call, so page and face cannot disagree — they are one function.
 * What one function cannot promise is that the function is RIGHT.
 *
 * And "right" here is not a matter of taste. A `.md` in somebody's vault is
 * read by other things — GitHub renders it, an editor colours it, a static
 * site builds from it — and every one of them uses micromark's rule or a copy
 * of it: exactly three dashes on line one, closed by exactly three dashes, and
 * an unclosed fence is not frontmatter at all. A vault whose owner sees the
 * block hidden on GitHub and drawn as a phantom heading here has met two
 * answers about their own file.
 *
 * So this is the fence: `remark-frontmatter` is a devDependency of this
 * package for no other purpose than the pipeline BELOW, which nothing ships
 * and nothing else imports. Each body is asked twice — parsed by the library
 * with the block hidden, and parsed by the plain pipeline after `proseIn` has
 * taken it off — and the two have to draw the same page. A drift in either
 * direction fails here rather than in somebody's vault.
 *
 * It lives in `@olai/web` rather than in `@olai/format` for the reason
 * `slugs.test.ts` does: this is the seam where both readings exist, and the
 * floor deliberately cannot import a markdown parser at all.
 */

import { proseIn } from "@olai/format"
import { expect, test } from "bun:test"
import rehypeStringify from "rehype-stringify"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

/** The ECOSYSTEM's reading: the library that owns micromark's frontmatter
 *  construct, with the same dialect a `.md` in a vault is written in.
 *  `mdast-util-to-hast` drops the node it makes, so a block it recognises
 *  simply is not on the page. */
const theirs = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)

/** OURS: the same pipeline with no frontmatter extension at all — which is
 *  what this app actually ships (`./pipeline.ts`) — handed the prose that
 *  `proseIn` left. */
const ours = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)

const agree = (body: string): void => {
  expect(String(ours.processSync(proseIn(body))))
    .toEqual(String(theirs.processSync(body)))
}

/**
 * Every corner `@olai/format`'s `frontmatter.test.ts` pins by hand, asked of
 * the library instead — so the sentences written out there are checked against
 * something rather than remembered.
 */
test("our rule and micromark's draw the same page", () => {
  // The ordinary block.
  agree("---\ntitle: x\nowners: [a, b]\n---\n\n# Real\n\nProse.\n")
  // …and an empty one, which is still a block.
  agree("---\n---\n\n# Real\n")

  // UNCLOSED is not frontmatter: a thematic break and a paragraph.
  agree("---\ntitle: x\n\n# Real\n")
  // …nor is one that does not open on line one.
  agree("Prose.\n\n---\ntitle: x\n---\n")

  // The fence is exactly three dashes, at the left margin.
  agree("----\ntitle: x\n---\n# Real\n")
  agree(" ---\ntitle: x\n---\n# Real\n")
  agree("---\ntitle: x\n----\n# Real\n")
  agree("---\ntitle: x\n ---\n# Real\n")
  // YAML's own `...` does not close the yaml preset's dash fence.
  agree("---\ntitle: x\n...\n# Real\n")

  // Trailing whitespace is what a line ending drags along, on either fence…
  agree("--- \ntitle: x\n---\t\n# Real\n")
  // …and so is the `\r` of a file written on Windows.
  agree("---\r\ntitle: x\r\n---\r\n\r\n# Real\r\n")

  // A body with no block at all is handed straight through by both.
  agree("# Real\n\nProse with a --- in it.\n")
  agree("")
})
