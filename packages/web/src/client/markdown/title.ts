/**
 * A node's title, as safe HTML.
 *
 * Two view-time concerns that belong together because they share one string:
 * the title is stored verbatim, and both the markdown and the `#tags` in it
 * are decided only when it is drawn. One function answers both, so a tree row
 * and a zoomed heading cannot disagree about either.
 *
 * There are three ways it can answer, and which one a title gets is the whole
 * of how an outline paints before the markdown machinery has arrived:
 *
 *   1. **plain** — the title has no markdown in it at all (./plain.ts), so it
 *      is words and tags and the answer is immediate. Nearly every title.
 *   2. **rendered** — it does have markdown, and ./pipeline.ts is here.
 *   3. **the source, escaped and ILLEGIBLE** — it has markdown and the
 *      pipeline is still on its way. What is drawn is what the person wrote,
 *      marks and all, blurred and swept by the one rule every waiting markdown
 *      surface wears (`data-markdown="waiting"`, ../styles.css) — so the row
 *      is the width its real characters make and nothing moves on the page
 *      when the words arrive, but no reader ever reads the marks. Which answer
 *      this is is part of the answer ({@link TitleDrawing}), because the
 *      caller is what puts that face on. The memo that asked is re-run when
 *      the chunk lands (./chunk.ts).
 *
 * Ordering matters within (2), and it is the reverse of what it used to be:
 *
 *   1. **inline markdown first** — same pipeline a note uses, forced to
 *      phrasing content (`renderToTree` + `toInline`).
 *   2. **then `#tags`** — walk the finished HAST and style tags in text nodes.
 *      The walk enters everything, including `code` and `a`; what is off under
 *      those two is the TAG SPLIT alone, so a tag inside code stays code and a
 *      URL fragment is not mistaken for a tag, while a filtered page still
 *      lights the query's words wherever they sit (./tags.ts).
 *
 * Peeling tags *before* markdown would split constructs across two parser runs
 * (`**urgent #home**` loses its bold; `[spec](…#home)` shreds the link). Tags
 * after markdown keeps every construct whole.
 *
 * When the drawing loses text the source still accounts for — an empty render
 * of a non-empty source, or less text than markdown's own reading of that
 * source says is in it (`Use <Component> here` → `Use  here`) — fall back to
 * the escaped source. A title that looks correct while missing a word is worse
 * than the marks. The fallback is plain escaped text (no tag styling): it is
 * "show what you wrote", not a second render path.
 *
 * A FILTERED PAGE HANDS DOWN ITS NEEDLES, and they ride both of the first two
 * answers rather than one: the words a query found this node by are wrapped
 * where they sit (`../filter/lit.ts`), so a row says which part of its title
 * put it in front of the reader. The third answer draws none — escaped source
 * is the "show what you wrote" fallback, and marking it up is exactly what it
 * is refusing to do.
 */

import type { Element, ElementContent, Root, RootContent, Text } from "hast"

import { NO_NEEDLES } from "../filter/lit.ts"
import { markdownReady } from "./chunk.ts"
import { plainTitle } from "./plain.ts"
import { hastToHtml, renderToTree, sourceText } from "./render.ts"
import { escapeHtml, styleTags } from "./tags.ts"

export interface TitleRender {
  /** When false, markdown links are unwrapped to their children so the title
   *  can sit inside an existing `<a>` (breadcrumb, see-ref) without nesting. */
  readonly links?: boolean
  /**
   * The words a filter found this node by, lit inside the title
   * (../filter/lit.ts) — empty, which is every title on an unfiltered page.
   *
   * The one option that is not a property of the title: it is a fact about the
   * PAGE, handed down so a row can say why it is in front of somebody. Which
   * is also why a highlighted title is not remembered below.
   */
  readonly needles?: ReadonlyArray<string>
}

/**
 * Titles have their own caches: short, numerous, long-lived — a different
 * population from notes, and one that would thrash the note cache at ~500 rows
 * if they shared the 512-slot map. TWO of them, because a plain title and a
 * rendered one are different populations again:
 *
 *   - a PLAIN title (./plain.ts) depends on nothing but the title, so it is
 *     keyed on the title alone and the same words in a row, a breadcrumb and a
 *     see-ref are one entry rather than three;
 *   - a RENDERED one depends on the file it is in (relative pictures), on
 *     whether its links survive, and on the query's needles, so it is keyed on
 *     all four.
 *
 * Separate maps rather than one, because the caps are what they are for: plain
 * titles are ~99% of them and cost a few regexes, and letting them fill a
 * shared map would drop the handful of pipeline renders — the expensive
 * ones — on every clear.
 *
 * A FILTERED PAGE IS WHERE THE TWO CAPS EARN THEIR SEPARATION, and it decides
 * the needles differently for each. The query changes on every keystroke, so a
 * needle in a key is an entry nobody asks for twice — which is why a
 * highlighted PLAIN title is drawn and not remembered at all (`isPlain` plus a
 * tag split is microseconds, and a filtered page would otherwise clear this map
 * every few keystrokes). A highlighted RENDERED one is remembered, needles and
 * all, for the opposite reason: it is a whole unified parse, there is no
 * virtual scroller under the tree, and re-parsing every matched markdown title
 * on every keystroke is the cost this cache exists to refuse.
 */
const plainTitles = new Map<string, string>()
const rendered = new Map<string, string>()
const CACHE_LIMIT = 1024

/**
 * A title, drawn — and WHICH of the three answers it is.
 *
 * The rung is part of the answer because the third one is a STATE the page has
 * to wear: escaped source is not the title, it is what stands in for the title
 * while the renderer is on its way, and a caller that could not tell the two
 * apart would have to draw raw `**` as though it were the words somebody meant
 * ({@link TitleDrawing.waiting}).
 */
export interface TitleDrawing {
  /** HTML, safe for `innerHTML`. */
  readonly html: string
  /**
   * True for the THIRD answer alone — the escaped source, drawn because
   * ./chunk.ts has not landed. The caller puts the app's one waiting face on
   * it (`data-markdown="waiting"`, blurred and swept by ../styles.css), which
   * is the same face a note and a document body wear for the same reason.
   *
   * False for the first two: a plain title is the finished thing, and a
   * rendered one is the answer itself.
   */
  readonly waiting: boolean
}

/** An answer that is FINISHED — the plain title, the rendering, and the
 *  escaped source `build` falls back to when the drawing lost words the source
 *  still accounts for. None of those is waiting for anything. */
const drawn = (html: string): TitleDrawing => ({ html, waiting: false })

/**
 * One title → one drawing of it, safe for `innerHTML`.
 *
 * THE LADDER IS WRITTEN ONCE — plain, then rendered, then the escaped source —
 * and the caches are conditions on it rather than a second copy of it. It was
 * briefly two: a filtered page had a fork of its own that skipped the lookups,
 * which is the same three answers held to each other by nothing, and the one
 * path with no sweep over it (./plain.test.ts holds the FAST path against the
 * pipeline, never one caller against another).
 */
export const renderTitle = (
  title: string,
  from: string,
  options: TitleRender = {},
): TitleDrawing => {
  const needles = options.needles ?? NO_NEEDLES
  const links = options.links !== false

  // A plain title under a query is drawn and not remembered — see the caches'
  // own note. Unfiltered, which is nearly every title this app draws, the
  // lookup is the first thing that happens.
  if (needles.length === 0) {
    const wasPlain = plainTitles.get(title)
    if (wasPlain !== undefined) return drawn(wasPlain)
  }
  const plain = plainTitle(title, needles)
  if (plain !== null) {
    return drawn(needles.length === 0 ? remember(plainTitles, title, plain) : plain)
  }

  const key = `${links ? "a" : "n"}\n${from}\n${needles.join("\u0000")}\n${title}`
  const hit = rendered.get(key)
  if (hit !== undefined) return drawn(hit)

  // Not cached: this is what the title looks like WHILE the chunk is coming,
  // and a cache is exactly the thing that would still be handing it out
  // afterwards. The read is what re-runs the caller's memo when it lands — and
  // `waiting` is what has the row draw that source illegibly until it does.
  if (!markdownReady()) return { html: escapeHtml(title), waiting: true }

  return drawn(remember(rendered, key, build(title, from, links, needles)))
}

const remember = (
  cache: Map<string, string>,
  key: string,
  html: string,
): string => {
  if (cache.size >= CACHE_LIMIT) cache.clear()
  cache.set(key, html)
  return html
}

const build = (
  title: string,
  from: string,
  links: boolean,
  needles: ReadonlyArray<string>,
): string => {
  const tree = renderToTree(title, from, "inline")
  styleTags(tree, needles)
  if (!links) unwrapAnchors(tree)

  // The pipeline dropped words the source still accounts for — fully empty,
  // or less text than markdown reads in the source (raw HTML is text there and
  // nothing here, so `Use <Component> here` fails the check when the pipeline
  // leaves only "Use  here").
  if (title.trim() !== "" && lostText(title, tree)) {
    return escapeHtml(title)
  }
  return hastToHtml(tree)
}

/**
 * True when what was DRAWN is missing text the source still accounts for.
 *
 * Two numbers off one title: the text of the tree the pipeline produced, and
 * the text markdown reads in the source (./render.ts's `sourceText`, which is
 * that parser's own answer rather than a second opinion about markdown — raw
 * HTML counts as its characters there, and an image's `alt` as its words,
 * because those are exactly what a drawn title drops).
 *
 * Shorter than accounted-for is a loss; longer is not — a rendering adds text
 * of its own (a heading's anchor, a footnote's number, the space ./inline.ts
 * opens between two unwrapped blocks), and none of that is a title losing a
 * word.
 *
 * IT WAS A LIST OF REGEXES stripping marks off the source, which is a second
 * markdown dialect standing beside the real one — the thing ./plain.ts refuses
 * a title rather than keep. It could not read NESTING: `**b *c* d**` matched no
 * bold rule whole, the marks the inner run left behind stayed in the count, the
 * count came out longer than the render, and `a **b *c* d** e` was drawn as its
 * own escaped source with a stray `*` in it (the same for `**a *b* c**`, the
 * underscore spellings, and every `&amp;` — five characters of source and one
 * of text).
 */
const lostText = (title: string, tree: Root): boolean => {
  const drawn = collapse(renderedText(tree))
  if (drawn === "") return true
  return drawn.length < collapse(sourceText(title)).length
}

const collapse = (value: string): string => value.replace(/\s+/g, " ").trim()

/** Lift every `<a>` to its children so a title inside a Link has no nested
 *  anchors. Recurses first so nested structure is flattened cleanly. */
const unwrapAnchors = (parent: Root | Element): void => {
  const next: ElementContent[] = []
  for (const child of parent.children) {
    if (child.type !== "element") {
      if (child.type === "text") next.push(child)
      continue
    }
    unwrapAnchors(child)
    if (child.tagName === "a") {
      next.push(...(child.children as ElementContent[]))
    } else {
      next.push(child)
    }
  }
  parent.children = next as typeof parent.children
}

/** The text a rendering DREW — the other half of the loss check, and the one
 *  that is a walk over HTML rather than over markdown. */
const renderedText = (tree: Root): string => {
  let out = ""
  const walk = (nodes: ReadonlyArray<RootContent | ElementContent>): void => {
    for (const node of nodes) {
      if (node.type === "text") out += (node as Text).value
      else if (node.type === "element") walk(node.children)
    }
  }
  walk(tree.children)
  return out
}
