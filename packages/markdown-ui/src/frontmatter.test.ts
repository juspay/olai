import { proseIn } from "@olai/format"
import { expect, test } from "bun:test"
import rehypeStringify from "rehype-stringify"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import { unified } from "unified"

const theirs = unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)

const ours = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)

const agree = (body: string): void => {
  expect(String(ours.processSync(proseIn(body))))
    .toEqual(String(theirs.processSync(body)))
}

test("our rule and micromark's draw the same page", () => {
  agree("---\ntitle: x\nowners: [a, b]\n---\n\n# Real\n\nProse.\n")
  agree("---\n---\n\n# Real\n")

  agree("---\ntitle: x\n\n# Real\n")
  agree("Prose.\n\n---\ntitle: x\n---\n")

  agree("----\ntitle: x\n---\n# Real\n")
  agree(" ---\ntitle: x\n---\n# Real\n")
  agree("---\ntitle: x\n----\n# Real\n")
  agree("---\ntitle: x\n ---\n# Real\n")
  agree("---\ntitle: x\n...\n# Real\n")

  agree("--- \ntitle: x\n---\t\n# Real\n")
  agree("---\r\ntitle: x\r\n---\r\n\r\n# Real\r\n")

  agree("# Real\n\nProse with a --- in it.\n")
  agree("")
})
