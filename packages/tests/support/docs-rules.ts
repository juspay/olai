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
 * also read in olai itself — `just serve` with no argument serves
 * `website/docs/` — so a second parser here could disagree with the screen
 * about what a paragraph, a table cell or a footnote is.
 *
 * THE READING BUDGET (rules 4a–4d) is about what a reader sees before opening
 * anything: the MAIN FLOW, which is the page minus its footnote definitions and
 * minus any `<details>` block. The detail is still on the page, one click or
 * tap away, and the page-length rule still counts it.
 */

import { claim, slugOf } from "@olai/format"
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
  /** Rule 8: a whole page, footnotes and `<details>` included. A page that
   *  cannot fit is two pages. */
  page: 2500,
  /** Rule 13: one sentence. */
  sentence: 40,
  /** Rule 4a: the opening paragraph, the line or two that says the one thing. */
  opening: 30,
  /** Rule 4b: everything a reader sees without opening anything — about a
   *  minute of reading. */
  main: 250,
  /** Rule 4c: the `##` sections of the main flow. */
  sections: 5,
  /** Rule 4d: one footnote, which the site shows as a popup. */
  note: 100,
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

/**
 * The page's top-level blocks, each marked as MAIN FLOW or not. A footnote
 * definition is not, and neither is anything between a `<details>` line and
 * its `</details>`, the two places a page keeps what a reader opens on
 * purpose.
 */
const flow = (tree: MarkdownNode): ReadonlyArray<{ node: MarkdownNode; main: boolean }> => {
  let open = 0
  return children(tree).map((node) => {
    const html = node.type === "html" ? (node.value ?? "") : ""
    open += (html.match(/<details\b/gu) ?? []).length
    const inside = open > 0
    open -= (html.match(/<\/details>/gu) ?? []).length
    return { node, main: !inside && node.type !== "footnoteDefinition" }
  })
}

/** Rules 7 and 8: how much running text sits under one heading of the main
 *  flow, and on the whole page, asides included. Tables and code are left out
 *  of the section count for the reason the skill gives — they are looked at,
 *  not read — and table cells are counted into the page, because a page made
 *  of tables is still a page to get through. */
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
  for (const { node, main } of flow(tree)) {
    const count = words(read(node))
    page += count
    if (!main || node.type === "table") continue
    if (node.type === "heading") {
      close()
      heading = opening(read(node))
      line = lineOf(node)
      section = 0
      continue
    }
    section += count
  }
  close()
  if (page > LIMIT.page) {
    found.push({ rule: 8, line: 1, said: `${page} words on one page (limit ${LIMIT.page})` })
  }
  return found
}

/**
 * Rules 4a–4d, the reading budget: the opening says the one thing, the main
 * flow is about a minute, it has few sections, and each footnote fits the
 * popup the site shows it in. Table cells count into the main flow, because a
 * reader reads them; headings and code do not, as everywhere else.
 */
const budgetFindings = (tree: MarkdownNode): ReadonlyArray<Finding> => {
  const found: Finding[] = []
  const blocks = flow(tree)
  const main = blocks.filter((block) => block.main).map((block) => block.node)
  const first = main.find((node) => node.type !== "heading")
  if (first?.type === "paragraph" && words(read(first)) > LIMIT.opening) {
    found.push({
      rule: 4,
      line: lineOf(first),
      said: `the opening is ${words(read(first))} words (limit ${LIMIT.opening}): say the one thing, and footnote the rest`,
    })
  }
  const seen = main.filter((node) => node.type !== "heading").reduce((sum, node) => sum + words(read(node)), 0)
  if (seen > LIMIT.main) {
    found.push({
      rule: 4,
      line: 1,
      said: `${seen} words before any footnote or <details> is opened (limit ${LIMIT.main})`,
    })
  }
  const sections = main.filter((node) => node.type === "heading" && node.depth === 2).length
  if (sections > LIMIT.sections) {
    found.push({ rule: 4, line: 1, said: `${sections} ## sections in the main flow (limit ${LIMIT.sections})` })
  }
  // A definition nothing cites is dropped by the renderer, so its facts would
  // be on the page's source and nowhere a reader can reach.
  const identifier = (node: MarkdownNode): string => node.identifier ?? ""
  const cited = new Set([...walk(tree)].filter((node) => node.type === "footnoteReference").map(identifier))
  for (const { node } of blocks) {
    if (node.type !== "footnoteDefinition") continue
    const count = words(read(node))
    if (count > LIMIT.note) {
      found.push({
        rule: 4,
        line: lineOf(node),
        said: `footnote of ${count} words (limit ${LIMIT.note}): split it, or move a long table or listing into <details>`,
      })
    }
    if (!cited.has(identifier(node))) {
      found.push({ rule: 4, line: lineOf(node), said: `footnote [^${identifier(node)}] is never cited, so no reader can reach it` })
    }
  }
  return found
}

/**
 * Rule 10: a paragraph that opens in bold is a heading in disguise, and
 * nothing can link to it.
 *
 * Only the paragraphs the page itself holds are read. A LIST ITEM MAY OPEN
 * WITH A BOLD TERM — `- **Doing** — the mark a row carries while you are on
 * it` is a definition list, which is the shape the standard asks for rather
 * than the one it bans. A table cell is left alone for the same reason.
 */
const runInFindings = (tree: MarkdownNode): ReadonlyArray<Finding> => {
  const found: Finding[] = []
  const look = (node: MarkdownNode): void => {
    for (const child of children(node)) {
      if (child.type === "listItem" || child.type === "tableCell") continue
      if (child.type === "paragraph") {
        const first = children(child)[0]
        if (first?.type === "strong" && children(child).length > 1) {
          found.push({
            rule: 10,
            line: lineOf(child),
            said: `paragraph opens with a bold run-in: “${opening(read(first))}”`,
          })
        }
        continue
      }
      look(child)
    }
  }
  look(tree)
  return found
}

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
 * several ways, so a page with several faults reports all of them rather than
 * one per run. `budgeted` is false for the docs index alone: it is the site's
 * page map, drawn as cards, and nobody reads it top to bottom.
 */
export const findingsIn = (source: string, budgeted = true): ReadonlyArray<Finding> => {
  const tree = mdastOf(source)
  return [
    ...(budgeted ? budgetFindings(tree) : []),
    ...lengthFindings(tree),
    ...blockFindings(tree),
    ...cellFindings(tree),
    ...runInFindings(tree),
    ...voiceFindings(tree),
  ].sort((one, two) => one.line - two.line || one.rule - two.rule)
}

/**
 * The anchors a page offers, spelled as olai spells them: the format's own
 * `slugOf` over the heading's TEXT, and `claim` for a second heading of the
 * same words. That is what puts the id on the heading a reader lands at
 * (`@olai/markdown-ui`'s `slugs.ts`), so a link check with a spelling of its
 * own would pass addresses the app cannot open.
 *
 * Here rather than in the test because the heading's text is the parsed one —
 * code spans, emphasis and links already taken off by {@link read} — which is
 * the reading the renderer gives it too.
 */
export const anchorsIn = (source: string): ReadonlySet<string> => {
  const seen = new Map<string, number>()
  const taken = new Set<string>()
  for (const node of walk(mdastOf(source))) {
    if (node.type !== "heading") continue
    taken.add(claim(seen, slugOf(plain(node).trim())))
  }
  return taken
}

/** A node's words as the renderer reads them, with a code span's own
 *  characters kept — which is what a heading's id is made of. {@link read}
 *  cannot be used for this: it stands a placeholder in for code, so a heading
 *  that is a command would get the placeholder's slug. */
const plain = (node: MarkdownNode): string => {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? ""
  return children(node)
    .map(plain)
    .join("")
}
