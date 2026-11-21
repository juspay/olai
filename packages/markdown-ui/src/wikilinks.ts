/**
 * WIKILINKS ON THE PAGE — how a `[[name]]` gets through the parser, and what
 * it is drawn as once it has.
 *
 * Markdown has no wikilink, so the pipeline is handed one it can read: each
 * link `@olai/format`'s scan finds (the very scan the references index reads,
 * so the page and the index agree on what a text holds) is written as an
 * ordinary `[words](#carrier)` before parsing ({@link wikilinked}). The words
 * are escaped, so a wikilink shows its words as text; the carrier names which
 * link of the text it was and carries a seal made from the whole text, so a
 * hand-written `[x](#olai-wikilink-0)` stays a fragment link — and a carrier
 * stands only for a wikilink the text really holds ({@link carriersOf}).
 *
 * WHAT IT FINDS DEPENDS ON THE DIRECTORY, so the drawing is a function of the
 * membership ({@link drawnWikilink}) and is written twice from one answer: by
 * `./rewrite.ts` after the sanitiser, when a rendering has the membership in
 * hand, and by `./Markdown.tsx` in the page, every time the membership moves,
 * without re-rendering the prose ({@link applyWikilink}).
 */
import {
  addressOf,
  type Claims,
  deadLinkSaid,
  isPicture,
  namesIn,
  printAddress,
  type Wikilink,
  wikilinkAddress,
  wikilinkFallback,
  wikilinkPath,
  wikilinkPicture,
  wikilinksIn,
} from "@olai/format"
import { TESTID } from "@olai/markdown-ui/testids.ts"
import { mediaHref } from "@olai/surface"

/** What an undrawn picture looks like: a quiet inline box, in the same family
 *  as the app's other readouts. */
export const UNDRAWN = "inline-block rounded border border-rule px-1.5 py-0.5 " +
  "font-mono text-xs text-muted"

const CARRIER = "#olai-wikilink-"

/** A short seal of a whole text — FNV-1a, for "this carrier came from this
 *  text". 32 bits promise no note cannot spell it; what keeps a hand-written
 *  carrier harmless is that one stands only for a wikilink the text really
 *  holds ({@link carriersOf}), so a forged one draws that link and no other. */
const sealOf = (source: string): string => {
  let hash = 0x811c9dc5
  for (let at = 0; at < source.length; at++) {
    hash ^= source.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

/** Every ASCII punctuation mark, which a backslash makes literal. */
const PUNCTUATION = /[!-/:-@[-`{-~]/g

/**
 * The text with each wikilink written as a markdown link the parser will read:
 * `[[kitchen-sink#Tables|the table]]` → `[the table](#olai-wikilink-0-<seal>)`.
 * Identity when the text holds none, so a cache keyed on the text keeps its
 * key. A picture embed is written the same way; `./rewrite.ts` draws it.
 */
export const wikilinked = (source: string): string => {
  const links = wikilinksIn(source)
  if (links.length === 0) return source
  const seal = sealOf(source)
  let out = ""
  let last = 0
  links.forEach((link, at) => {
    out += source.slice(last, link.start) + `[${link.shown.replace(PUNCTUATION, "\\$&")}](${CARRIER}${at}-${seal})`
    last = link.end
  })
  return out + source.slice(last)
}

/**
 * The wikilinks of a text, read once and only when a rendering of it meets a
 * carrier — and which of them a carrier `href` stands for.
 */
export const carriersOf = (source: string): ((href: string) => Wikilink | undefined) => {
  let links: ReadonlyArray<Wikilink> | undefined
  let seal: string | undefined
  return (href) => {
    if (!href.startsWith(CARRIER)) return undefined
    const [at, written] = href.slice(CARRIER.length).split("-")
    seal ??= sealOf(source)
    if (written !== seal || at === undefined || !/^\d+$/.test(at)) return undefined
    links ??= wikilinksIn(source)
    return links[Number(at)]
  }
}

/** One wikilink as the page keeps it: the name it looks up, whether it was an
 *  embed, and the size an embed's `|200` or `|200x100` asks for. */
export interface Written {
  readonly name: string
  readonly embed: boolean
  readonly size?: string
}

/** The size a picture embed's alias asks for, or nothing. */
export const sizeOf = (alias: string | null): string | undefined =>
  alias !== null && /^\d+(?:x\d+)?$/.test(alias) ? alias : undefined

/** What a wikilink is drawn as, for one membership. */
export type Drawn =
  /** A link: its page, or nothing to open (`href` absent); `dead` is the
   *  sentence a link that finds nothing is named with. */
  | { readonly kind: "link"; readonly href?: string; readonly dead?: string }
  /** A picture embed whose name finds a picture this page may draw. */
  | { readonly kind: "picture"; readonly src: string }
  /** A picture embed that finds nothing it may draw, in words. */
  | { readonly kind: "undrawn"; readonly words: string }
  /** A picture embed drawn before the membership is known. */
  | { readonly kind: "waiting" }

/**
 * What one wikilink draws as, from the file `from`, with `members` the served
 * files — `undefined` when they are not known yet, which judges nothing and
 * guesses nothing: the link opens nothing until its name is looked up, as a
 * picture embed waits.
 *
 * A picture embed (`![[handle.png]]`) is the picture, through the same
 * allowlist a `![](…)` meets: a picture kind's file, inside the directory,
 * never an inert `.svg`. Anything else — and every embed in a title, which is
 * one line high — is a link, to the page its name finds, or, when it finds
 * nothing, to the page that says so.
 */
export const drawnWikilink = (
  claims: Claims | undefined,
  members: ReadonlySet<string> | undefined,
  from: string,
  written: Written,
  inline = false,
): Drawn => {
  const target = written.name.split("#", 1)[0] as string
  const names = claims === undefined || members === undefined ? undefined : namesIn(claims, members)
  if (claims !== undefined && written.embed && !inline && wikilinkPicture(claims, target)) {
    if (names === undefined) return { kind: "waiting" }
    const path = wikilinkPath(names, claims, from, target)
    return path !== null && isPicture(claims, path)
      ? { kind: "picture", src: mediaHref(path) }
      : { kind: "undrawn", words: `this picture could not be drawn: ${target}` }
  }
  if (claims === undefined || names === undefined) return { kind: "link" }
  const address = wikilinkAddress(names, claims, from, written.name)
  if (address !== null) return { kind: "link", href: "/" + printAddress(address) }
  if (target === "") return { kind: "link" }
  const fallback = wikilinkFallback(claims, target)
  const page = fallback === null ? null : addressOf(claims, fallback, null)
  return {
    kind: "link",
    ...(page === null ? {} : { href: "/" + printAddress(page) }),
    dead: deadLinkSaid({ written: `[[${written.name}]]`, resolved: target, suggest: [] }),
  }
}

/** The element a drawing is, as a tag, its attributes and its text — one
 *  shape for the tree `./rewrite.ts` writes and the DOM `./Markdown.tsx`
 *  keeps in step. `words` is what a link shows, which opens a dead link's
 *  name. */
export interface Drawing {
  readonly tag: "a" | "img" | "span"
  readonly attributes: Readonly<Record<string, string>>
  /** The words inside, for an element whose words this decides. */
  readonly text?: string
}

export const drawingOf = (drawn: Drawn, written: Written, words: string): Drawing => {
  const marks: Record<string, string> = { "data-wikilink": written.name }
  if (drawn.kind === "link") {
    return {
      tag: "a",
      attributes: {
        ...(drawn.href === undefined ? {} : { href: drawn.href }),
        ...marks,
        ...(drawn.dead === undefined ? {} : {
          "data-dead": "true",
          "aria-label": words === "" ? drawn.dead : `${words} — ${drawn.dead}`,
          class: "olai-dead-link",
        }),
      },
    }
  }
  const picture = { ...marks, "data-wikilink-picture": "", ...(written.size === undefined ? {} : { "data-wikilink-size": written.size }) }
  if (drawn.kind === "picture") {
    const [width, height] = (written.size ?? "").split("x")
    return {
      tag: "img",
      attributes: {
        src: drawn.src,
        alt: written.name.split("#", 1)[0] as string,
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
      attributes: { class: UNDRAWN, "data-testid": TESTID.undrawnPicture, "data-src": written.name, ...picture },
      text: drawn.words,
    }
  }
  return { tag: "span", attributes: picture, text: "" }
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
  members: ReadonlySet<string> | undefined,
  from: string,
): void => {
  const name = element.dataset["wikilink"]
  if (name === undefined) return
  const picture = element.hasAttribute("data-wikilink-picture")
  const size = element.dataset["wikilinkSize"]
  const written: Written = { name, embed: picture, ...(size === undefined ? {} : { size }) }
  const drawing = drawingOf(drawnWikilink(claims, members, from, written), written, picture ? "" : (element.textContent ?? "").trim())
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
  if (drawing.tag === "a") element.classList.toggle("olai-dead-link", "class" in drawing.attributes)
  else if (drawing.attributes["class"] !== undefined) element.setAttribute("class", drawing.attributes["class"])
  if (drawing.text !== undefined && element.textContent !== drawing.text) element.textContent = drawing.text
}
