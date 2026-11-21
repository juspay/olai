/**
 * WHAT OBSIDIAN ADDS TO MARKDOWN, read inside the parser: `[[note]]` and
 * `![[picture.png]]`, and a link whose address holds a space,
 * `[a](my file.md)`.
 *
 * INSIDE THE PARSER, not before it, and that is the point: the parser already
 * knows what is code, what is a comment and what is escaped, so a `[[…]]` in a
 * code span, an HTML comment or after a backslash is text by the parser's own
 * rule — not by a second rule held beside it. Both are micromark constructs;
 * `./parse.ts` attaches them.
 *
 * A WIKILINK is one node, `wikilink`, carrying what was written: the `target`
 * before any `#` or `|`, the `fragments` after each `#` (the last is where it
 * lands; one opening with `^` is a block reference), the `alias` after a `|`,
 * and whether it is an `embed` (`![[…]]`). The words inside are text, never
 * Markdown, so its one child is the text it shows: the alias, or the target
 * and its fragments joined by ` > `. Inside a table cell the bar is written
 * `\|`, as in Obsidian, and is the alias bar all the same.
 *
 * Not a wikilink: an empty one (`[[]]`, `[[#]]`), an unclosed one, one broken
 * across lines, one holding a lone bracket — each is the characters it is.
 *
 * A SPACED ADDRESS is `[a](my file.md)`: CommonMark reads a space as the end
 * of an address, so that text is not a link to it, while a vault written
 * elsewhere names files with spaces all the time. The address runs to the
 * `)`, or to the title (`"…"`, `'…'` or `(…)`) when one follows a space.
 * An address with no space is read by CommonMark's own rule, untouched.
 */
import type { Parent, Text } from "mdast"
import type { CompileContext, Extension as FromMarkdownExtension, Token as FromMarkdownToken } from "mdast-util-from-markdown"
import { labelEnd } from "micromark-core-commonmark"
import { factoryTitle } from "micromark-factory-title"
import { factoryWhitespace } from "micromark-factory-whitespace"
import { markdownLineEnding, markdownLineEndingOrSpace, markdownSpace } from "micromark-util-character"
import type { Code, Construct, Effects, Extension, State, TokenizeContext } from "micromark-util-types"

/** A wikilink as the tree holds it. */
export interface WikilinkNode extends Parent {
  readonly type: "wikilink"
  /** The name before any `#` and `|`, trimmed; empty for `[[#Heading]]`. */
  readonly target: string
  /** Each `#` part after the target, trimmed, empty ones dropped. */
  readonly fragments: ReadonlyArray<string>
  /** The words after the `|`, trimmed, or `null`. On an embed, the size. */
  readonly alias: string | null
  /** Written `![[…]]`. */
  readonly embed: boolean
  /** One text: what the link shows. */
  children: [Text]
}

declare module "mdast" {
  interface PhrasingContentMap {
    wikilink: WikilinkNode
  }
  interface RootContentMap {
    wikilink: WikilinkNode
  }
}

declare module "micromark-util-types" {
  interface TokenTypeMap {
    wikilink: "wikilink"
    wikilinkMarker: "wikilinkMarker"
    wikilinkString: "wikilinkString"
  }
}

const BANG = 33
const OPEN = 91
const CLOSE = 93
const BACKSLASH = 92
const PAREN_OPEN = 40
const PAREN_CLOSE = 41
const ANGLE_OPEN = 60
const QUOTE = 34
const APOSTROPHE = 39

/** What the text between `[[` and `]]` says, or `null` when it names nothing. */
const readWikilink = (inner: string, embed: boolean): Omit<WikilinkNode, "type" | "children"> & { readonly shown: string } | null => {
  const text = inner.replaceAll("\\|", "|")
  const bar = text.indexOf("|")
  const named = bar === -1 ? text : text.slice(0, bar)
  const words = bar === -1 ? "" : text.slice(bar + 1).trim()
  const parts = named.split("#")
  const target = (parts[0] as string).trim()
  const fragments = parts.slice(1).map((part) => part.trim()).filter((part) => part !== "")
  if (target === "" && fragments.length === 0) return null
  const alias = words === "" ? null : words
  return {
    target,
    fragments,
    alias,
    embed,
    shown: alias ?? (target === "" ? fragments : [target, ...fragments]).join(" > "),
  }
}

/** `[[…]]` and `![[…]]`, on one line, holding no bracket of their own. */
const wikilink: Construct = {
  name: "wikilink",
  tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    const self = this
    let embed = false
    let slashes = 0
    let content = ""
    const start: State = (code) => {
      effects.enter("wikilink")
      effects.enter("wikilinkMarker")
      if (code === BANG) {
        embed = true
        effects.consume(code)
        return first
      }
      return first(code)
    }
    const first: State = (code) => {
      if (code !== OPEN) return nok(code)
      effects.consume(code)
      return second
    }
    const second: State = (code) => {
      if (code !== OPEN) return nok(code)
      effects.consume(code)
      effects.exit("wikilinkMarker")
      return opening
    }
    const opening: State = (code) => {
      if (code === CLOSE) return nok(code)
      effects.enter("wikilinkString")
      return inside(code)
    }
    const inside: State = (code) => {
      if (code === null || markdownLineEnding(code) || code === OPEN) return nok(code)
      if (code === CLOSE) {
        // An escaped `]` is no close, and no character a name holds either.
        if (slashes % 2 === 1) return nok(code)
        content = self.sliceSerialize(effects.exit("wikilinkString"))
        effects.enter("wikilinkMarker")
        effects.consume(code)
        return closing
      }
      slashes = code === BACKSLASH ? slashes + 1 : 0
      effects.consume(code)
      return inside
    }
    const closing: State = (code) => {
      if (code !== CLOSE || readWikilink(content, embed) === null) return nok(code)
      effects.consume(code)
      effects.exit("wikilinkMarker")
      effects.exit("wikilink")
      return ok
    }
    return start
  },
}

/** Whitespace and then the opening of a title — the one thing that ends a
 *  spaced address before its `)`. Only ever asked as a check. */
const titleAhead: Construct = {
  partial: true,
  tokenize(effects: Effects, ok: State, nok: State): State {
    const spaces: State = (code) => {
      if (markdownSpace(code)) {
        effects.consume(code)
        return spaces
      }
      effects.exit("whitespace")
      return code === QUOTE || code === APOSTROPHE || code === PAREN_OPEN ? ok(code) : nok(code)
    }
    return (code) => {
      effects.enter("whitespace")
      return spaces(code)
    }
  },
}

/** `(address with spaces "title")` after a link's label — the resource half
 *  of CommonMark's own, with an address that may hold a space. Asked only
 *  where CommonMark's address would stop at that space; an address holding
 *  none is left to CommonMark. */
const spacedResource: Construct = {
  partial: true,
  tokenize(effects: Effects, ok: State, nok: State): State {
    let spaced = false
    const start: State = (code) => {
      effects.enter("resource")
      effects.enter("resourceMarker")
      effects.consume(code)
      effects.exit("resourceMarker")
      return before
    }
    const before: State = (code) => markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, open)(code) : open(code)
    const open: State = (code) => {
      if (code === null || code === ANGLE_OPEN || code === PAREN_CLOSE || markdownLineEnding(code)) return nok(code)
      effects.enter("resourceDestination")
      effects.enter("resourceDestinationRaw")
      effects.enter("resourceDestinationString")
      effects.enter("chunkString", { contentType: "string" })
      return address(code)
    }
    const address: State = (code) => {
      if (code === null || markdownLineEnding(code)) return nok(code)
      if (code === PAREN_CLOSE) return addressEnd(code)
      if (markdownSpace(code)) return effects.check(titleAhead, addressEnd, space)(code)
      effects.consume(code)
      return address
    }
    const space: State = (code) => {
      spaced = true
      effects.consume(code)
      return address
    }
    const addressEnd: State = (code) => {
      if (!spaced) return nok(code)
      effects.exit("chunkString")
      effects.exit("resourceDestinationString")
      effects.exit("resourceDestinationRaw")
      effects.exit("resourceDestination")
      return markdownSpace(code) ? factoryWhitespace(effects, between)(code) : end(code)
    }
    const between: State = (code) =>
      code === QUOTE || code === APOSTROPHE || code === PAREN_OPEN
        ? factoryTitle(effects, titleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code)
        : end(code)
    const titleAfter: State = (code) => markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, end)(code) : end(code)
    const end: State = (code: Code) => {
      if (code !== PAREN_CLOSE) return nok(code)
      effects.enter("resourceMarker")
      effects.consume(code)
      effects.exit("resourceMarker")
      effects.exit("resource")
      return ok
    }
    return start
  },
}

/**
 * A link's `]`, tried before CommonMark's own: it answers only a label
 * followed by a spaced address, and leaves every other `]` — and the label it
 * closes — untouched for CommonMark, whose resolvers build the link either
 * way.
 */
const spacedLabelEnd: Construct = {
  name: "spacedLabelEnd",
  ...(labelEnd.resolveAll === undefined ? {} : { resolveAll: labelEnd.resolveAll }),
  ...(labelEnd.resolveTo === undefined ? {} : { resolveTo: labelEnd.resolveTo }),
  tokenize(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
    const self = this
    let index = self.events.length
    let opened = false
    while (index--) {
      const token = self.events[index]?.[1]
      if (token !== undefined && (token.type === "labelImage" || token.type === "labelLink") && token._balanced !== true) {
        opened = token._inactive !== true
        break
      }
    }
    const after: State = (code) => code === PAREN_OPEN ? effects.attempt(spacedResource, ok, nok)(code) : nok(code)
    return (code) => {
      if (!opened) return nok(code)
      effects.enter("labelEnd")
      effects.enter("labelMarker")
      effects.consume(code)
      effects.exit("labelMarker")
      effects.exit("labelEnd")
      return after
    }
  },
}

/** The micromark half: the constructs, tried before CommonMark's. */
export const obsidianSyntax: Extension = {
  text: {
    [BANG]: wikilink,
    [OPEN]: wikilink,
    [CLOSE]: spacedLabelEnd,
  },
}

/** The tree half: one `wikilink` node per `[[…]]`. */
export const obsidianFromMarkdown: FromMarkdownExtension = {
  enter: {
    wikilink(this: CompileContext, token: FromMarkdownToken): undefined {
      const written = this.sliceSerialize(token)
      const embed = written.startsWith("!")
      const read = readWikilink(written.slice(embed ? 3 : 2, -2), embed)
      // The construct refused every text this answers `null` for.
      if (read === null) throw new Error(`a wikilink token holds no wikilink: ${written}`)
      const { shown, ...node } = read
      this.enter({ type: "wikilink", ...node, children: [{ type: "text", value: shown }] }, token)
    },
  },
  exit: {
    wikilink(this: CompileContext, token: FromMarkdownToken): undefined {
      this.exit(token)
    },
  },
}
