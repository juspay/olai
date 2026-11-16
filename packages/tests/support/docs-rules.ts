/**
 * The shape rules of `dev/skills/docs-writing/SKILL.md`, as findings a test can
 * be red about.
 *
 * The standard is prose and prose does not hold. These pages were written one
 * appended paragraph per pull request until a single page ran to 30,000 words,
 * so the limits a reader actually feels — how long a block is before the eye
 * gives up, how long a sentence is before it has to be read twice — are checked
 * on every page of the served set, with no exemption list and no per-page
 * override. A rule that is wrong is changed in the skill and here, for every
 * page at once.
 *
 * WHAT COUNTS AS A WORD is the one decision everything else rests on, so it is
 * made in one place ({@link words}): running text, with code left out. A fenced
 * block is not prose and a reader does not read it as prose; an inline code span
 * is one word, because `olai web --port` is one thing to take in however many
 * characters it holds. Headings are not counted either: a heading is a signpost,
 * and counting it would make a page of good signposts look like a long one.
 *
 * THE PARSER IS THE APP'S OWN (`@olai/markdown-ui`'s `mdastOf`). These pages are
 * read in a browser that renders them through that pipeline — `just serve` with
 * no argument serves `docs/` — so a second parser here could disagree with the
 * screen about what a paragraph or a table cell is, and the lint would be
 * policing a document nobody reads.
 */

import { type MarkdownNode, mdastOf } from "@olai/markdown-ui/pipeline.ts"

/** One rule broken, in one place, with enough of the text to find it. */
export interface Finding {
  /** The rule's number in the skill, so a failure can be looked up. */
  readonly rule: number
  /** Line of the page it is on. */
  readonly line: number
  /** What is wrong, with the measurement that makes it wrong. */
  readonly said: string
}

/** A block or a sentence is this long before a reader stops taking it in. The
 *  numbers are the skill's, and the skill is where an argument about them
 *  belongs. */
const LIMIT = {
  /** Rule 5: a paragraph, or one item of a list. */
  block: 80,
  /** Rule 6: one cell of a table. A cell needing more is an entry of its own. */
  cell: 40,
  /** Rule 7: running text under one heading, before the reader needs a new one. */
  section: 300,
  /** Rule 8: a whole page. A page that cannot fit is two pages. */
  page: 2500,
  /** Rule 13: one sentence. */
  sentence: 40,
} as const

/**
 * Capitals that are a word rather than a shout. Rule 16 bans capitals for
 * emphasis, and the only way to tell the two apart is a list: these are the
 * acronyms and initialisms olai's pages genuinely need. A name the reader types
 * or sees on screen (`PATH`, `HEAD`, `SIGTERM`) is code and goes in backticks,
 * which is why none of those are here.
 */
const ACRONYMS = new Set([
  "ACP",
  "AGPL",
  "API",
  "CLI",
  "CSS",
  "CSV",
  "DOM",
  "GPU",
  "HTML",
  "HTTP",
  "HTTPS",
  "IME",
  "ISO",
  "JSON",
  "JWT",
  "MCP",
  "PDF",
  "PNG",
  "RCA",
  "README",
  "RPC",
  "SDK",
  "SSH",
  "SVG",
  "TLS",
  "TTY",
  "URI",
  "URL",
  "UTC",
  "YAML",
])

/** Rule 18's words. A page says what is true now; what used to be true is in
 *  the commit log. */
const HISTORY = [
  "used to",
  "no longer",
  "any more",
  "anymore",
  "previously",
  "formerly",
  "until now",
  "as before",
  "is gone",
  "are gone",
  "has since",
  "nowadays",
]

const children = (node: MarkdownNode): ReadonlyArray<MarkdownNode> => node.children ?? []

/**
 * A node's text as the lint reads it: a code span becomes one capitalised
 * placeholder word, a fenced block and raw HTML become nothing.
 *
 * The placeholder is capitalised so that a sentence opening with code starts a
 * sentence like any other, and it carries no punctuation so that a semicolon or
 * a dash inside a command is never read as the writer's own.
 */
const read = (node: MarkdownNode): string => {
  if (node.type === "text") return node.value ?? ""
  if (node.type === "inlineCode") return "Code"
  if (node.type === "code" || node.type === "html") return ""
  if (node.type === "image") return ""
  return children(node)
    .map(read)
    .join("")
}

/** How many words a piece of running text is. Punctuation alone is not a
 *  word. */
const words = (text: string): number =>
  text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length

/** Where a node starts, for a failure a reader can jump to. */
const lineOf = (node: MarkdownNode): number => node.position?.start.line ?? 0

/** The first words of a block, so a failure names the block rather than
 *  describing one. */
const opening = (text: string): string => {
  const flat = text.replace(/\s+/gu, " ").trim()
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat
}

/**
 * Running text, split into sentences. A full stop, question mark or exclamation
 * mark ends one when the next thing to start is a new word; an abbreviation
 * that is a lower-case letter followed by a stop does not, which is why the
 * split looks ahead for a capital, a digit, or an opening bracket or quote.
 */
const sentences = (text: string): ReadonlyArray<string> =>
  text
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}"'“‘([])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)

/** Every node of the tree, in document order. */
const walk = function* (node: MarkdownNode): Generator<MarkdownNode> {
  yield node
  for (const child of children(node)) yield* walk(child)
}

/** The blocks a reader reads as prose: paragraphs and list items, wherever they
 *  sit, but not the ones inside a table cell (rule 6 measures those). */
const prose = function* (node: MarkdownNode, inCell = false): Generator<MarkdownNode> {
  for (const child of children(node)) {
    if (child.type === "tableCell") {
      yield* prose(child, true)
      continue
    }
    if (!inCell && (child.type === "paragraph" || child.type === "heading")) {
      if (child.type === "paragraph") yield child
      continue
    }
    yield* prose(child, inCell)
  }
}

/** Rule 5, and rules 13 and 14 over the sentences inside each block. */
const blockFindings = (tree: MarkdownNode): ReadonlyArray<Finding> =>
  [...prose(tree)].flatMap((block) => {
    const text = read(block)
    const found: Finding[] = []
    const count = words(text)
    if (count > LIMIT.block) {
      found.push({
        rule: 5,
        line: lineOf(block),
        said: `${count} words in one block (limit ${LIMIT.block}): “${opening(text)}”`,
      })
    }
    for (const sentence of sentences(text)) {
      const length = words(sentence)
      if (length > LIMIT.sentence) {
        found.push({
          rule: 13,
          line: lineOf(block),
          said: `${length}-word sentence (limit ${LIMIT.sentence}): “${opening(sentence)}”`,
        })
      }
      // Rule 14. `--` counts as a dash because the page renders it as one.
      const dashes = (sentence.match(/—|--/gu) ?? []).length
      if (dashes > 1) {
        found.push({
          rule: 14,
          line: lineOf(block),
          said: `${dashes} dashes in one sentence: “${opening(sentence)}”`,
        })
      }
      const semicolons = (sentence.match(/;/gu) ?? []).length
      if (semicolons > 1) {
        found.push({
          rule: 14,
          line: lineOf(block),
          said: `${semicolons} semicolons in one sentence: “${opening(sentence)}”`,
        })
      }
    }
    return found
  })

/** Rule 6: a table cell is a glance, not a paragraph. */
const cellFindings = (tree: MarkdownNode): ReadonlyArray<Finding> =>
  [...walk(tree)].flatMap((node) => {
    if (node.type !== "tableCell") return []
    const text = read(node)
    const count = words(text)
    if (count <= LIMIT.cell) return []
    return [
      {
        rule: 6,
        line: lineOf(node),
        said: `${count} words in one table cell (limit ${LIMIT.cell}): “${opening(text)}”`,
      },
    ]
  })

/** Rules 7 and 8: how much running text sits under one heading, and on the
 *  whole page. Tables and code are left out of the section count for the reason
 *  the skill gives — they are looked at, not read — and table cells are counted
 *  into the page, because a page made of tables is still a page to get through. */
const lengthFindings = (tree: MarkdownNode): ReadonlyArray<Finding> => {
  const found: Finding[] = []
  let heading = "the opening"
  let line = 1
  let section = 0
  let page = 0
  const close = (): void => {
    if (section > LIMIT.section) {
      found.push({
        rule: 7,
        line,
        said: `${section} words under “${heading}” (limit ${LIMIT.section})`,
      })
    }
  }
  for (const node of children(tree)) {
    if (node.type === "heading") {
      close()
      heading = opening(read(node))
      line = lineOf(node)
      section = 0
      continue
    }
    if (node.type === "table") {
      page += words(read(node))
      continue
    }
    const count = words(read(node))
    section += count
    page += count
  }
  close()
  if (page > LIMIT.page) {
    found.push({ rule: 8, line: 1, said: `${page} words on one page (limit ${LIMIT.page})` })
  }
  return found
}

/** Rule 10: a paragraph that opens in bold is a heading in disguise, and the
 *  sidebar cannot see it. A list item opening with a bold term is allowed, so
 *  only paragraphs the page itself holds are read. */
const runInFindings = (tree: MarkdownNode): ReadonlyArray<Finding> =>
  [...walk(tree)].flatMap((node) => {
    if (node.type !== "paragraph") return []
    const first = children(node)[0]
    if (first?.type !== "strong" || children(node).length < 2) return []
    return [
      {
        rule: 10,
        line: lineOf(node),
        said: `paragraph opens with a bold run-in: “${opening(read(first))}”`,
      },
    ]
  })

/** Rule 16's second half, and rule 18. Emphasis is not shouted, and a page does
 *  not remember. */
const voiceFindings = (tree: MarkdownNode): ReadonlyArray<Finding> =>
  [...walk(tree)].flatMap((node) => {
    if (node.type !== "text") return []
    const text = node.value ?? ""
    const found: Finding[] = []
    for (const shout of new Set(text.match(/\b\p{Lu}{3,}\b/gu) ?? [])) {
      if (ACRONYMS.has(shout)) continue
      found.push({
        rule: 16,
        line: lineOf(node),
        said: `“${shout}” is capitals for emphasis (an acronym goes in the lint's list, a name in backticks)`,
      })
    }
    const lower = text.toLowerCase()
    for (const phrase of HISTORY) {
      if (!lower.includes(phrase)) continue
      found.push({
        rule: 18,
        line: lineOf(node),
        said: `“${phrase}” tells the page's history: say what is true now`,
      })
    }
    return found
  })

/**
 * Every shape rule, over one page's source. The page is parsed once and read
 * six ways, so a page with several faults reports all of them rather than one
 * per run.
 */
export const findingsIn = (source: string): ReadonlyArray<Finding> => {
  const tree = mdastOf(source)
  return [
    ...lengthFindings(tree),
    ...blockFindings(tree),
    ...cellFindings(tree),
    ...runInFindings(tree),
    ...voiceFindings(tree),
  ].sort((one, two) => one.line - two.line || one.rule - two.rule)
}

/** How long a page's running text is, by the same reading — what the rewrite's
 *  own ledger quotes. */
export const wordsIn = (source: string): number => {
  const tree = mdastOf(source)
  let total = 0
  for (const node of children(tree)) {
    if (node.type === "heading") continue
    total += words(read(node))
  }
  return total
}
