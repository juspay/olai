/**
 * TREE TO ONE VALUE — everything a reader of a text asks of it, read once.
 *
 * The links (each address cut once into path, query and fragment), the
 * pictures, the wikilinks, the headings with their slugs, the tags and
 * mentions, the first line and the words. Every reader of text asks this
 * rather than walking the text itself, so the page and the index read a note
 * one way.
 *
 * WHAT IS TEXT is the parser's call: code holds no link, wikilink, tag,
 * mention or heading, and neither does an HTML comment. Tags and mentions are
 * read from the tree's text outside code and outside links — the page's rule,
 * the one place a `#` was already drawn as a tag — with the splitter in
 * `./tags.ts`.
 *
 * TWO SHORTCUTS, both answers the parse would give. A one-line text that
 * `./plain.ts` says holds no markup is its own parse, so it is read without
 * the parser; `./read.test.ts` holds the two equal over every title in the
 * fixture outlines. A text the guard refuses (`./parse.ts`) is read as plain
 * words with no links, and says it was refused, so a page can say so.
 */
import type { Nodes, Root } from "mdast"

import type { WikilinkNode } from "./obsidian.ts"
import { guarded, type Refusal } from "./parse.ts"
import { isPlain } from "./plain.ts"
import { claim, type Slug, slugOf } from "./slug.ts"
import { type Tag, tagsOf } from "./tags.ts"

/** An address as written, cut once: the path before any `?` or `#`, the
 *  query between them, the fragment after the `#`. */
export interface Cut {
  /** The address as the text wrote it, escapes and references decoded. */
  readonly url: string
  readonly path: string
  readonly query: string | null
  readonly fragment: string | null
}

/** A link, `[words](address)` or `[words][label]` with its definition. */
export interface ReadLink extends Cut {
  readonly words: string
}

/** A picture, `![alt](address)` or `![alt][label]`. */
export interface ReadPicture extends Cut {
  readonly alt: string
}

/** A wikilink as it was written. */
export interface ReadWikilink {
  readonly target: string
  readonly fragments: ReadonlyArray<string>
  readonly alias: string | null
  readonly embed: boolean
}

/** A heading: the words it draws, and the slug they make — numbered once
 *  here when two headings share words. Empty words make no slug. */
export interface ReadHeading {
  readonly depth: number
  readonly words: string
  readonly slug: Slug | null
}

/** Everything a text says. */
export interface Read {
  readonly links: ReadonlyArray<ReadLink>
  readonly pictures: ReadonlyArray<ReadPicture>
  readonly wikilinks: ReadonlyArray<ReadWikilink>
  readonly headings: ReadonlyArray<ReadHeading>
  /** Tags and mentions, as written, in reading order. */
  readonly tags: ReadonlyArray<Tag>
  /** The words of the first line that draws any, or `""`. */
  readonly firstLine: string
  /** Every word the text draws, its blocks one line each. */
  readonly words: string
  /** Why the text was read as plain words, when it was. */
  readonly refused?: Refusal
}

const NONE: ReadonlyArray<never> = []

/** Cut an address into its three parts, once. */
export const cut = (url: string): Cut => {
  const hash = url.indexOf("#")
  const before = hash === -1 ? url : url.slice(0, hash)
  const question = before.indexOf("?")
  return {
    url,
    path: question === -1 ? before : before.slice(0, question),
    query: question === -1 ? null : before.slice(question + 1),
    fragment: hash === -1 ? null : url.slice(hash + 1),
  }
}

/** A text read as plain words: a title with no markup, or a refused text. */
const plainly = (text: string, refused?: Refusal): Read => {
  const first = firstLineOf(text)
  return {
    links: NONE,
    pictures: NONE,
    wikilinks: NONE,
    headings: NONE,
    tags: tagsOf(text),
    firstLine: first,
    words: text,
    ...(refused === undefined ? {} : { refused }),
  }
}

const firstLineOf = (text: string): string => {
  for (const line of text.split("\n")) if (line.trim() !== "") return line.trim()
  return ""
}

/** What a text says. */
export const read = (text: string): Read => {
  if (isPlain(text)) return plainly(text)
  const parsed = guarded(text)
  if (parsed.refused !== undefined) return plainly(text, parsed.refused)
  return readTree(parsed.tree)
}

/** What a parsed tree says. */
export const readTree = (tree: Root): Read => {
  const walk = new Walk(tree)
  walk.block(tree)
  return walk.done()
}

/** Where a link label's definition sends it, by the label's identifier. */
const definitionsOf = (tree: Root): ReadonlyMap<string, string> => {
  const found = new Map<string, string>()
  const visit = (node: Nodes): void => {
    if (node.type === "definition" && !found.has(node.identifier)) found.set(node.identifier, node.url)
    if ("children" in node) for (const child of node.children) visit(child)
  }
  visit(tree)
  return found
}

/** The nodes that are blocks: each one starts a line of the words. */
const BLOCKS = new Set(["paragraph", "heading", "code", "listItem", "tableRow", "blockquote", "footnoteDefinition", "html", "thematicBreak", "definition"])

/** One walk of a tree, collecting as it goes. */
class Walk {
  private readonly definitions: ReadonlyMap<string, string>
  private readonly links: Array<ReadLink> = []
  private readonly pictures: Array<ReadPicture> = []
  private readonly wikilinks: Array<ReadWikilink> = []
  private readonly headings: Array<ReadHeading> = []
  private readonly tags: Array<Tag> = []
  private readonly slugs = new Map<string, number>()
  private readonly lines: Array<string> = []
  private line = ""

  constructor(tree: Root) {
    this.definitions = definitionsOf(tree)
  }

  /** A block: its words are a line of their own. */
  block(node: Nodes): void {
    if (node.type === "heading") {
      const words = squeezed(this.phrasing(node, false))
      this.say(words)
      const slug = slugOf(words)
      this.headings.push({ depth: node.depth, words, slug: slug === "" ? null : claim(this.slugs, slug) })
      this.end()
      return
    }
    if (node.type === "code") {
      this.say(node.value)
      this.end()
      return
    }
    if (node.type === "paragraph" || node.type === "tableCell") {
      this.say(this.phrasing(node, false))
      if (node.type === "tableCell") this.say(" ")
      else this.end()
      return
    }
    if ("children" in node) {
      for (const child of node.children) this.block(child)
      if (BLOCKS.has(node.type)) this.end()
    }
  }

  /** The words a run of phrasing draws, filing what it holds on the way. */
  private phrasing(node: Nodes, inLink: boolean): string {
    switch (node.type) {
      case "text":
        if (!inLink) for (const tag of tagsOf(node.value)) this.tags.push(tag)
        return node.value
      case "inlineCode":
        return node.value
      case "break":
        return "\n"
      case "wikilink":
        this.wikilinks.push(wikilinkOf(node))
        return node.children[0].value
      case "link": {
        const words = this.children(node, true)
        this.links.push({ ...cut(node.url), words })
        return words
      }
      case "linkReference": {
        const words = this.children(node, true)
        const url = this.definitions.get(node.identifier)
        if (url !== undefined) this.links.push({ ...cut(url), words })
        return words
      }
      case "image":
        this.pictures.push({ ...cut(node.url), alt: node.alt ?? "" })
        return ""
      case "imageReference": {
        const url = this.definitions.get(node.identifier)
        if (url !== undefined) this.pictures.push({ ...cut(url), alt: node.alt ?? "" })
        return ""
      }
      case "html":
        return ""
      default:
        return "children" in node ? this.children(node, inLink) : ""
    }
  }

  private children(node: Nodes & { readonly children: ReadonlyArray<Nodes> }, inLink: boolean): string {
    let words = ""
    for (const child of node.children) words += this.phrasing(child, inLink)
    return words
  }

  private say(words: string): void {
    this.line += words
  }

  private end(): void {
    if (this.line.trim() !== "") this.lines.push(this.line)
    this.line = ""
  }

  done(): Read {
    this.end()
    const words = this.lines.join("\n")
    return {
      links: this.links.length === 0 ? NONE : this.links,
      pictures: this.pictures.length === 0 ? NONE : this.pictures,
      wikilinks: this.wikilinks.length === 0 ? NONE : this.wikilinks,
      headings: this.headings.length === 0 ? NONE : this.headings,
      tags: this.tags.length === 0 ? NONE : this.tags,
      firstLine: firstLineOf(words),
      words,
    }
  }
}

/** A heading's words as the page draws them: whitespace runs as one space,
 *  and none at either end. */
const squeezed = (words: string): string => words.replace(/\s+/g, " ").trim()

const wikilinkOf = (node: WikilinkNode): ReadWikilink => ({
  target: node.target,
  fragments: node.fragments,
  alias: node.alias,
  embed: node.embed,
})
