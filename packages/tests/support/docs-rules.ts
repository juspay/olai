import { claim, slugOf } from "@olai/format"
import { type MarkdownNode, mdastOf } from "@olai/markdown-ui/pipeline.ts"

export interface Finding {
  readonly rule: number
  readonly line: number
  readonly said: string
}

const LIMIT = {
  paragraphWords: 80,
  tableCellWords: 40,
  sectionWords: 300,
  pageWords: 3000,
  sentenceWords: 40,
  openingWords: 30,
  mainFlowWords: 250,
  mainFlowSections: 5,
  footnoteWords: 100,
} as const

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

const read = (node: MarkdownNode): string => {
  if (node.type === "text") return node.value ?? ""
  if (node.type === "inlineCode") return "Code"
  if (node.type === "code" || node.type === "html") return ""
  if (node.type === "image") return ""
  return children(node)
    .map(read)
    .join("")
}

const words = (text: string): number =>
  text.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length

const lineOf = (node: MarkdownNode): number => node.position?.start.line ?? 0

const opening = (text: string): string => {
  const flat = text.replace(/\s+/gu, " ").trim()
  return flat.length > 60 ? `${flat.slice(0, 60)}…` : flat
}

const sentences = (text: string): ReadonlyArray<string> =>
  text
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}"'“‘([])/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)

const walk = function* (node: MarkdownNode): Generator<MarkdownNode> {
  yield node
  for (const child of children(node)) yield* walk(child)
}

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

const blockFindings = (tree: MarkdownNode): ReadonlyArray<Finding> =>
  [...prose(tree)].flatMap((block) => {
    const text = read(block)
    const found: Finding[] = []
    const count = words(text)
    if (count > LIMIT.paragraphWords) {
      found.push({
        rule: 5,
        line: lineOf(block),
        said: `${count} words in one block (limit ${LIMIT.paragraphWords}): “${opening(text)}”`,
      })
    }
    for (const sentence of sentences(text)) {
      const length = words(sentence)
      if (length > LIMIT.sentenceWords) {
        found.push({
          rule: 13,
          line: lineOf(block),
          said: `${length}-word sentence (limit ${LIMIT.sentenceWords}): “${opening(sentence)}”`,
        })
      }
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

const cellFindings = (tree: MarkdownNode): ReadonlyArray<Finding> =>
  [...walk(tree)].flatMap((node) => {
    if (node.type !== "tableCell") return []
    const text = read(node)
    const count = words(text)
    if (count <= LIMIT.tableCellWords) return []
    return [
      {
        rule: 6,
        line: lineOf(node),
        said: `${count} words in one table cell (limit ${LIMIT.tableCellWords}): “${opening(text)}”`,
      },
    ]
  })

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

const lengthFindings = (tree: MarkdownNode): ReadonlyArray<Finding> => {
  const found: Finding[] = []
  let heading = "the opening"
  let line = 1
  let section = 0
  let page = 0
  const close = (): void => {
    if (section > LIMIT.sectionWords) {
      found.push({
        rule: 7,
        line,
        said: `${section} words under “${heading}” (limit ${LIMIT.sectionWords})`,
      })
    }
  }
  for (const { node, main } of flow(tree)) {
    const count = words(read(node))
    if (node.type !== "heading") page += count
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
  if (page > LIMIT.pageWords) {
    found.push({ rule: 8, line: 1, said: `${page} words on one page (limit ${LIMIT.pageWords})` })
  }
  return found
}

const budgetFindings = (tree: MarkdownNode): ReadonlyArray<Finding> => {
  const found: Finding[] = []
  const blocks = flow(tree)
  const main = blocks.filter((block) => block.main).map((block) => block.node)
  const first = main.find((node) => node.type !== "heading")
  if (first?.type === "paragraph" && words(read(first)) > LIMIT.openingWords) {
    found.push({
      rule: 4,
      line: lineOf(first),
      said: `the opening is ${words(read(first))} words (limit ${LIMIT.openingWords}): say the one thing, and footnote the rest`,
    })
  }
  const seen = main.filter((node) => node.type !== "heading").reduce((sum, node) => sum + words(read(node)), 0)
  if (seen > LIMIT.mainFlowWords) {
    found.push({
      rule: 4,
      line: 1,
      said: `${seen} words before any footnote or <details> is opened (limit ${LIMIT.mainFlowWords})`,
    })
  }
  const sections = main.filter((node) => node.type === "heading" && node.depth === 2).length
  if (sections > LIMIT.mainFlowSections) {
    found.push({ rule: 4, line: 1, said: `${sections} ## sections in the main flow (limit ${LIMIT.mainFlowSections})` })
  }
  const identifier = (node: MarkdownNode): string => node.identifier ?? ""
  const cited = new Set([...walk(tree)].filter((node) => node.type === "footnoteReference").map(identifier))
  for (const { node } of blocks) {
    if (node.type !== "footnoteDefinition") continue
    const count = words(read(node))
    if (count > LIMIT.footnoteWords) {
      found.push({
        rule: 4,
        line: lineOf(node),
        said: `footnote of ${count} words (limit ${LIMIT.footnoteWords}): split it, or move a long table or listing into <details>`,
      })
    }
    if (!cited.has(identifier(node))) {
      found.push({ rule: 4, line: lineOf(node), said: `footnote [^${identifier(node)}] is never cited, so no reader can reach it` })
    }
  }
  return found
}

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

export const anchorsIn = (source: string): ReadonlySet<string> => {
  const seen = new Map<string, number>()
  const taken = new Set<string>()
  for (const node of walk(mdastOf(source))) {
    if (node.type !== "heading") continue
    taken.add(claim(seen, slugOf(plain(node).trim())))
  }
  return taken
}

const plain = (node: MarkdownNode): string => {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? ""
  return children(node)
    .map(plain)
    .join("")
}
