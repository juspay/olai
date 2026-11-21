/**
 * olai's `#topic` and `@name`: the alphabet a tag is written in, and the
 * grammar that says where one starts and stops.
 *
 * Read by the index (`@olai/format`, which files tags and mentions), by the
 * page that styles them as pills, and by the completion that offers them —
 * one grammar, so the three cannot disagree about what a tag is. It needs no
 * parser and runs at first paint, so nothing here imports one.
 */
import { Schema } from "effect"

/**
 * A tag AS IT IS WRITTEN — the sigil and the name, `#topic` or `@person`.
 *
 * It is a NAME in the same sense a document's path, a node's id and a
 * heading's slug are: the grammar below decides where one starts and stops in
 * a text, and what it hands back is one
 * of these. Two namespaces, never two spellings of one — `#alice` and `@alice`
 * are different tags — which is why the sigil is part of the value and not
 * something a reader adds back.
 */
export const Tag = Schema.String.pipe(Schema.brand("Tag"))
export type Tag = typeof Tag.Type

/** THE ONE ALPHABET a tag name and a node id are written in — letters, digits,
 *  `_`, `-` and `/`, the last so `#work/olai` is one tag. Declared once, here,
 *  where the grammar is: `@olai/format`'s id rule and the completion read the
 *  same constant, because an id rule and a grammar that drifted apart would be
 *  an id nobody can mention and a completion offering ids its own trigger
 *  cannot see. */
export const MENTION_ALPHABET = "A-Za-z0-9_/-"

/**
 * The two characters that start a tag.
 *
 * `#` is what this format has always had; `@` joined it with the editor's tag
 * autocomplete (`input-widgets`), because Workflowy trains both hands and a
 * trigger that inserted the OTHER character would be an affordance writing text
 * the set does not recognise as a tag. They are two NAMESPACES rather than two
 * spellings of one: `#alice` and `@alice` are different tags, which is the
 * whole reason a person reaches for one rather than the other (`@` for who,
 * `#` for what).
 */
export const TAG_SIGILS = ["#", "@"] as const
export type TagSigil = (typeof TAG_SIGILS)[number]

/** One tag, split the way this format reads one: which sigil started it, and
 *  the name after it. */
export interface TitleTag {
  /** Which character started it — carried rather than assumed, so a part list
   *  rejoins to the title it came from. */
  readonly sigil: TagSigil
  /** The name, without the sigil. */
  readonly tag: string
}

/** A title, split into what to print and what to style. Tags live inline in
 *  the title verbatim — the format stores no tag list — so the split happens
 *  at view time, every time. */
export type TitlePart =
  | { readonly kind: "text"; readonly text: string }
  | ({ readonly kind: "tag" } & TitleTag)

/** The written form of a tag — the characters the title actually holds. One
 *  spelling, because every consumer that draws a tag or indexes one needs it
 *  and three of them re-assembling it is three chances to drop the `@`. It is
 *  also what the index's tag table is keyed by.
 *
 *  A {@link Tag}, which is the vocabulary's word for exactly this, so what
 *  this walk hands back says what it is rather than being one more string. */
export const tagText = (part: TitleTag): Tag => Tag.make(`${part.sigil}${part.tag}`)

/**
 * ...and the same reading backwards: a written tag split into its two halves.
 *
 * The inverse of {@link tagText}, beside it, because the index's tag keys are
 * written tags and a reader that wants the namespace and the name has to take
 * one apart. Doing that at the call site is a second, private claim about
 * where the sigil is — the thing this pair exists to keep to one place, which
 * is also why `@olai/format`'s `titleParts` splits its own matches through
 * this rather than beside it.
 *
 * It TRUSTS its argument, which is why it takes no failure: the only strings
 * this is asked about are a {@link titleTagRe} match and a key that
 * {@link tagText} wrote, and both are a sigil followed by a name.
 */
export const tagPart = (written: string): TitleTag => ({
  sigil: written[0] as TagSigil,
  tag: written.slice(1),
})

/**
 * Whether text could hold a tag AT ALL — a plain `indexOf` per sigil, and the
 * guard every walk of a text for tags takes first.
 *
 * That walk runs a global regex and allocates a part per segment, and most
 * prose holds no tag at all; the index's fold, the search index and the
 * client's two renderings of a pill all want the same cheap negative. It was
 * written three times before this existed, and the first two had already
 * drifted (one asked about `#` only).
 */
export const mayHoldTag = (text: string): boolean =>
  text.includes("#") || text.includes("@")

/**
 * A fresh `/g` regex for an inline tag in a title.
 *
 * A sigil followed by {@link MENTION_ALPHABET}'s letters — the last of them,
 * `/`, is there so `#work/olai` is one tag. A bare sigil is text. Returned
 * new each call so `/g` state is never shared across walks (the client styles
 * tags by walking HAST text nodes with the same alphabet, and must not
 * re-declare it).
 *
 * THE TWO SIGILS ARE NOT MATCHED THE SAME WAY, and the asymmetry is about what
 * people write rather than about tidiness: `@` sits inside ordinary words all
 * the time (`ann@example.com`, a handle quoted mid-sentence) and `#` essentially
 * does not, so `@` is claimed only where a word STARTS — the beginning of the
 * title, or after a space or an opening bracket. `#` keeps the alphabet it has
 * had since the format's first day, unchanged, because narrowing it would
 * restyle titles in sets that are already written.
 */
export const titleTagRe = (): RegExp =>
  new RegExp(`#[${MENTION_ALPHABET}]+|(?<![^\\s([{])@[${MENTION_ALPHABET}]+`, "g")

/**
 * Whether `text` is a tag NAME and nothing else — {@link MENTION_ALPHABET}
 * asked as a question.
 *
 * It exists because a client COMPLETING a tag has to know where one stops
 * while it is still half-typed, and this file already says the alphabet must
 * not be re-declared elsewhere. An empty name passes: `#` on its own is a tag
 * being started, which is exactly when a completion is wanted, and it is
 * {@link titleTagRe}'s business that a bare sigil is not yet a tag.
 */
export const isTagName = (text: string): boolean =>
  new RegExp(`^[${MENTION_ALPHABET}]*$`).test(text)

/**
 * Whether a sigil sitting at `at` STARTS a tag rather than sitting inside a
 * word — the beginning of the text, or after a space or an opening bracket.
 *
 * The rule {@link titleTagRe} applies to `@`, asked of ANY position, because a
 * completion wants it for both sigils: offering to rewrite the middle of
 * `issue#42` is offering to rewrite a word somebody is in the middle of
 * typing. What the format RECOGNISES as a tag is the regex's own, wider
 * question for `#`; this is only about where one may be started.
 */
export const tagOpensAt = (text: string, at: number): boolean =>
  at === 0 || /[\s([{]/.test(text[at - 1] as string)

/**
 * A text, split into what to print and what to style — the tags it writes,
 * in reading order, between runs of words.
 *
 * Asked of text that is ALREADY text: a node of a parsed tree outside code and
 * outside links, or a title with no markup at all. A wikilink is a node of
 * its own by then, so nothing here steps over one.
 *
 * `exec` in a loop over a fresh {@link titleTagRe}: the same matches `matchAll`
 * would make, without the iterator and the regex clone it allocates per call —
 * this is asked once per text node of every text a directory holds.
 */
export const tagParts = (text: string): ReadonlyArray<TitlePart> => {
  if (!mayHoldTag(text)) return text === "" ? NO_PARTS : [{ kind: "text", text }]
  const parts: Array<TitlePart> = []
  const tags = titleTagRe()
  let at = 0
  let match: RegExpExecArray | null
  while ((match = tags.exec(text)) !== null) {
    const start = match.index
    if (start > at) parts.push({ kind: "text", text: text.slice(at, start) })
    parts.push({ kind: "tag", ...tagPart(match[0]) })
    at = start + match[0].length
  }
  if (at < text.length) parts.push({ kind: "text", text: text.slice(at) })
  return parts
}

const NO_PARTS: ReadonlyArray<TitlePart> = []

/** The tags a text writes, as written, in reading order. */
export const tagsOf = (text: string): ReadonlyArray<Tag> => {
  if (!mayHoldTag(text)) return NO_TAGS
  let found: Array<Tag> | undefined
  for (const part of tagParts(text)) if (part.kind === "tag") (found ??= []).push(tagText(part))
  return found ?? NO_TAGS
}

const NO_TAGS: ReadonlyArray<Tag> = []

