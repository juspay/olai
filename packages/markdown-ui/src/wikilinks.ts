/**
 * WIKILINKS ON THE PAGE — what a `[[name]]` is drawn as.
 *
 * The parser reads a wikilink itself (`@olai/prose`'s `obsidian.ts`), and the
 * pipeline draws its node as an `<a>` carrying the name it looks up and the
 * words it shows (`./pipeline.ts`).
 *
 * WHAT IT FINDS DEPENDS ON THE DIRECTORY, so the drawing is a function of the
 * directory's NAME INDEX ({@link drawnWikilink}) — the served files by the
 * name each is found under, which the vault plugin's served directory owns and
 * publishes (`plugins/vault/src/browser/directory.ts`'s `names`), replacing it
 * only when a path arrives or leaves. Nothing here builds one or remembers
 * one: it is handed in, and it carries the membership with it.
 *
 * The drawing is written twice from one answer: into the tree after the
 * sanitiser, when a rendering has the index in hand ({@link drawWikilink},
 * which `./rewrite.ts`'s walk calls), and into the page every time the index
 * moves, without re-rendering the prose ({@link applyWikilink}).
 *
 * A `[[name]]` IS A LINK, so where it opens and the mark it wears when it
 * finds nothing are the ones every link carries (`./rewrite/links.ts`'s
 * {@link linkDrawing}); a picture embed is a picture, and meets the allowlist
 * and the eager-or-lazy rule a `![](…)` does (`./rewrite/pictures.ts`). What
 * is this file's own is the lookup by NAME, and the marks that let the page do
 * it again.
 */
import {
  addressOf,
  type Claims,
  deadLinkSaid,
  isPicture,
  type Names,
  printAddress,
  wikilinkFallback,
  wikilinkLanding,
  wikilinkPath,
  wikilinkPicture,
} from "@olai/format"
import type { WikilinkName } from "@olai/prose/wikilink.ts"
import { TESTID } from "@olai/markdown-ui/testids.ts"
import { mediaHref } from "@olai/surface"
import type { Element } from "hast"

import { type Aim, DEAD_LINK, linkDrawing, textIn } from "./rewrite/links.ts"
import { type Pictures, UNDRAWN, waits } from "./rewrite/pictures.ts"

/** One wikilink as the page keeps it: the name it looks up, whether it was an
 *  embed, and the size an embed's `|200` or `|200x100` asks for. */
export interface Written {
  readonly link: WikilinkName
  readonly embed: boolean
  readonly size?: string
}

declare module "hast" {
  interface ElementData {
    /** A wikilink's `<a>`, from the pipeline's handler to {@link drawWikilink}. */
    wikilink?: Written
  }
}

/** The size a picture embed's alias asks for, or nothing. */
export const sizeOf = (alias: string | null): string | undefined =>
  alias !== null && /^\d+(?:x\d+)?$/.test(alias) ? alias : undefined

/** What a wikilink is drawn as, for one membership. */
export type Drawn =
  /** A link, aimed and marked as any link is (`./rewrite/links.ts`): its page,
   *  or nothing to open, and the sentence it is named with when it finds
   *  nothing. */
  | ({ readonly kind: "link" } & Aim)
  /** A picture embed whose name finds a picture this page may draw. */
  | { readonly kind: "picture"; readonly src: string }
  /** A picture embed that finds nothing it may draw, in words. */
  | { readonly kind: "undrawn"; readonly words: string }
  /** A picture embed drawn before the membership is known. */
  | { readonly kind: "waiting" }

/**
 * What one wikilink draws as, from the file `from`, with `names` the
 * directory's name index — `undefined` when the directory is not in hand yet,
 * which judges nothing and guesses nothing: the link opens nothing until its
 * name is looked up, as a picture embed waits.
 *
 * A picture embed (`![[handle.png]]`) is the picture, through the same
 * allowlist a `![](…)` meets: a picture kind's file, inside the directory,
 * never an inert `.svg`. Anything else — and every embed in a title, which is
 * one line high — is a link, to the page its name finds, or, when it finds
 * nothing, to the page that says so.
 */
export const drawnWikilink = (
  claims: Claims | undefined,
  names: Names | undefined,
  from: string,
  written: Written,
  inline = false,
): Drawn => {
  const target = written.link.target
  if (claims !== undefined && written.embed && !inline && wikilinkPicture(claims, target)) {
    if (names === undefined) return { kind: "waiting" }
    const path = wikilinkPath(names, claims, from, target)
    return path !== null && isPicture(claims, path)
      ? { kind: "picture", src: mediaHref(path) }
      : { kind: "undrawn", words: `this picture could not be drawn: ${target}` }
  }
  if (claims === undefined || names === undefined) return { kind: "link" }
  const landing = wikilinkLanding(names, claims, from, written.link)
  if (landing === null) return { kind: "link" }
  if ("found" in landing) return { kind: "link", href: "/" + printAddress(landing.found) }
  const fallback = wikilinkFallback(claims, target)
  const page = fallback === null ? null : addressOf(claims, fallback, null)
  return {
    kind: "link",
    ...(page === null ? {} : { href: "/" + printAddress(page) }),
    dead: deadLinkSaid({ kind: "name", resolved: landing.lookedFor, suggest: [] }),
  }
}

/** The element a drawing is, as a tag, its attributes and its text — one
 *  shape for the tree {@link drawWikilink} writes and the DOM
 *  {@link applyWikilink} keeps in step. `words` is what a link shows, which
 *  opens a dead link's name. */
export interface Drawing {
  readonly tag: "a" | "img" | "span"
  readonly attributes: Readonly<Record<string, string>>
  /** The words inside, for an element whose words this decides. */
  readonly text?: string
}

/** The marks a drawn wikilink carries, so the browser can draw it again as the
 *  directory moves: the target, and its `#` parts as a list — never one
 *  string to be split. */
const marksOf = (link: WikilinkName): Record<string, string> => ({
  "data-wikilink": link.target,
  ...(link.fragments.length === 0 ? {} : { "data-wikilink-fragments": JSON.stringify(link.fragments) }),
})

export const drawingOf = (drawn: Drawn, written: Written, words: string): Drawing => {
  const marks = marksOf(written.link)
  // A LINK IS A LINK: its href and its dead mark are the ones `./rewrite/
  // links.ts` writes for a `[x](y.md)` too, with the wikilink's own marks
  // between them. A wikilink has no authored title to carry.
  if (drawn.kind === "link") return { tag: "a", attributes: linkDrawing(drawn, words, marks) }
  const picture = { ...marks, "data-wikilink-picture": "", ...(written.size === undefined ? {} : { "data-wikilink-size": written.size }) }
  if (drawn.kind === "picture") {
    const [width, height] = (written.size ?? "").split("x")
    return {
      tag: "img",
      attributes: {
        src: drawn.src,
        alt: written.link.target,
        decoding: "async",
        ...(width === undefined || width === "" ? {} : { width }),
        ...(height === undefined ? {} : { height }),
        ...picture,
      },
    }
  }
  if (drawn.kind === "undrawn") {
    return {
      tag: "span",
      attributes: { class: UNDRAWN, "data-testid": TESTID.undrawnPicture, "data-src": written.link.target, ...picture },
      text: drawn.words,
    }
  }
  return { tag: "span", attributes: picture, text: "" }
}

/** The wikilink an `<a>` is, as `./pipeline.ts` left it on the element's
 *  `data`, or `undefined` for every other link. */
export const wikilinkOf = (element: Element): Written | undefined => element.data?.wikilink

/**
 * A wikilink in the TREE, drawn from the marks the pipeline put on it: the
 * link to the page its name finds, marked dead when the name index in hand
 * finds nothing — or, for a picture embed, the picture, or the words saying
 * why there is none. Drawn after the sanitiser (`./rewrite.ts`'s walk), so a
 * note cannot carry a mark of its own.
 */
export const drawWikilink = (
  element: Element,
  written: Written,
  claims: Claims | undefined,
  names: Names | undefined,
  from: string,
  inline: boolean,
  pictures: Pictures,
): void => {
  const drawn = drawnWikilink(claims, names, from, written, inline)
  const drawing = drawingOf(drawn, written, drawn.kind === "link" ? textIn(element).trim() : "")
  const { class: classes, ...attributes } = drawing.attributes
  element.tagName = drawing.tag
  element.properties = { ...attributes, ...(classes === undefined ? {} : { className: classes.split(" ") }) }
  if (drawing.tag === "img") {
    // The same rule a `![](…)` keeps: the first picture of a block is not
    // deferred, every one after it is.
    element.properties["loading"] = waits(pictures) ? "lazy" : "eager"
    element.children = []
  } else if (drawing.text !== undefined) {
    element.children = drawing.text === "" ? [] : [{ type: "text", value: drawing.text }]
  }
}

/** The attributes {@link drawingOf} may write, so a drawing that no longer
 *  carries one takes it away. */
const MANAGED = ["href", "data-dead", "aria-label", "src", "alt", "width", "height", "decoding", "data-src", "data-testid"]

/**
 * A wikilink already on the page, brought in step with what it now finds —
 * in place when it is still the same kind of element, so a reader's selection
 * and the open folds around it stay; replaced when a picture becomes words or
 * words become a picture.
 */
export const applyWikilink = (
  element: HTMLElement,
  claims: Claims | undefined,
  names: Names | undefined,
  from: string,
): void => {
  const target = element.dataset["wikilink"]
  if (target === undefined) return
  const parts = element.dataset["wikilinkFragments"]
  const picture = element.hasAttribute("data-wikilink-picture")
  const size = element.dataset["wikilinkSize"]
  const written: Written = {
    link: { target, fragments: parts === undefined ? [] : JSON.parse(parts) as ReadonlyArray<string> },
    embed: picture,
    ...(size === undefined ? {} : { size }),
  }
  const drawing = drawingOf(drawnWikilink(claims, names, from, written), written, picture ? "" : (element.textContent ?? "").trim())
  if (element.tagName.toLowerCase() !== drawing.tag) {
    const next = element.ownerDocument.createElement(drawing.tag)
    for (const [key, value] of Object.entries(drawing.attributes)) next.setAttribute(key, value)
    if (drawing.text !== undefined) next.textContent = drawing.text
    element.replaceWith(next)
    return
  }
  for (const key of MANAGED) if (!(key in drawing.attributes)) element.removeAttribute(key)
  for (const [key, value] of Object.entries(drawing.attributes)) {
    if (key === "class") continue
    if (element.getAttribute(key) !== value) element.setAttribute(key, value)
  }
  if (drawing.tag === "a") element.classList.toggle(DEAD_LINK, "class" in drawing.attributes)
  else if (drawing.attributes["class"] !== undefined) element.setAttribute("class", drawing.attributes["class"])
  if (drawing.text !== undefined && element.textContent !== drawing.text) element.textContent = drawing.text
}
