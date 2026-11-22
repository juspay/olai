/**
 * A LINK TO A `.md` IS A LINK TO THAT DOCUMENT'S PAGE.
 *
 * `[the deck](../projects/deck.md)` is how a vault of Markdown files points at
 * itself, and the browser would resolve it against whatever ROUTE the page is
 * at — which is the document's own directory by luck, and the wrong place on
 * `/d/<date>`, where a note is drawn under an address that is not a file at
 * all. So it is resolved beside the file the link was WRITTEN in (a relative
 * name, checked against the served directory and resolved beside the file that
 * wrote it — `@olai/format`'s `relativeTo` half) and spelled as this app's own
 * document route. Nothing else is touched: a fragment stays a fragment, a
 * relative path to anything that is not a document is left exactly as written,
 * and a `http:`/`https:` link still goes where it says — in a new tab, so
 * clicking one cannot navigate this app away ({@link openExternal}).
 *
 * ## One answer, written in two places
 *
 * What a link CARRIES — where it opens, and, when the directory holds nothing
 * under it, the dead mark and the sentence it is named with — is
 * {@link linkDrawing}, and it is the only place any of that is spelled. Two
 * writers apply it:
 *
 *   - the tree, after the sanitiser ({@link resolveDocument}, and
 *     `../wikilinks.ts` for a `[[name]]`), which is what `renderMarkdown`
 *     returns;
 *   - the page ({@link applyLink}, and `../wikilinks.ts`'s `applyWikilink`),
 *     every time the directory's name index moves, so a file arriving or
 *     leaving heals or kills a link without the prose being rendered again and
 *     without a reader losing their selection.
 *
 * The two kinds differ in what the index can MOVE. A wikilink finds its file by
 * name, so the index decides its whole drawing — where it points included. A
 * standard link's address is already a path: the index can only say whether
 * anything is served under it, so the page re-decides the dead mark and nothing
 * else, and the href is settled once, here, at render time.
 */
import {
  addressOf,
  bodyKind,
  type Claims,
  deadLinkSaid,
  type Names,
  placeOf,
  printAddress,
  standardLanding,
} from "@olai/format"
import { cut } from "@olai/prose/cut.ts"
import type { Element } from "hast"

/** The class a link that finds nothing wears, which is what `../all.css`
 *  styles. One spelling: the tree writes it and the page toggles it. */
export const DEAD_LINK = "olai-dead-link"

/** WHERE A LINK GOES, for one membership: the page it opens, when there is one
 *  to open, and — when it finds nothing — the sentence it is named with. A
 *  standard link and a wikilink both answer in this shape, which is what lets
 *  one {@link linkDrawing} draw either. */
export interface Aim {
  readonly href?: string
  readonly dead?: string
}

/**
 * The attributes a link carries, from what it finds.
 *
 * `marks` are what the kind of link leaves for the page to find it by again —
 * the resolved path for a standard link, the name and fragments for a wikilink
 * — and they ride between the href and the dead mark so one shape serves both.
 *
 * THE WARNING GOES IN THE NAME, not on `title`. The authored title — the `"…"`
 * a writer put in their own `[x](y "…")` — stays exactly where markdown put it,
 * because that is the DOCUMENT's content and this pass is not its editor. What
 * this app has to SAY about the link is a different kind of thing, and `title`
 * was the wrong carrier for it twice over: it is drawn only under a pointer,
 * and a reader who never hovers is precisely the reader who most needs to be
 * told the target is not there. `<Tip>` cannot take it over either: a tip
 * renders the control it explains and measures its own first element child, and
 * these anchors are the sanitised HTML of somebody's document, written by
 * `innerHTML` and replaced wholesale on every render — wrapping each one would
 * mean a Solid root per link, minted and disposed inside an effect, which is a
 * second ownership tree for a tooltip.
 *
 * The name OPENS with the link's own words, and that is WCAG 2.5.3 (Label in
 * Name) rather than taste: a name that threw the visible text away would leave
 * somebody speaking "x" at a link their screen reader calls something else. The
 * authored title follows the words, because a reader who cannot see it is the
 * one who would otherwise never get it at all, and this app's sentence comes
 * last — the words, then the author's, then ours.
 */
export const linkDrawing = (
  aim: Aim,
  words: string,
  marks: Readonly<Record<string, string>> = {},
  authored = "",
): Readonly<Record<string, string>> => ({
  ...(aim.href === undefined ? {} : { href: aim.href }),
  ...marks,
  ...(aim.dead === undefined ? {} : {
    "data-dead": "true",
    "aria-label": [words, authored, aim.dead]
      .filter((part) => part !== "")
      .join(" — "),
    class: DEAD_LINK,
  }),
})

/** THE WORDS A LINK DRAWS, read off the tree rather than off the DOM, because
 *  the rewrite runs on the server where there is no DOM. It is what the name of
 *  a dead link has to open with (WCAG 2.5.3), and `mdast-util-to-string`'s
 *  hast sibling is not a dependency this package carries — the shape is five
 *  lines and a `text` node is the only one that holds any. */
export const textIn = (node: { readonly type: string; readonly value?: unknown; readonly children?: ReadonlyArray<unknown> }): string => {
  if (node.type === "text") return typeof node.value === "string" ? node.value : ""
  const children = node.children
  if (children === undefined) return ""
  return children.map((child) => textIn(child as Parameters<typeof textIn>[0])).join("")
}

/** THE DEAD DECISION for a standard link, which is the reading's own
 *  (`@olai/format`'s `standardLanding`, asked with the href AS WRITTEN and the
 *  file that wrote it): the sentence to name the link with when the directory
 *  serves nothing under the path it resolves to, or `undefined` — for a link
 *  that lands somewhere, and with no claims or no name index in hand, which
 *  judges nothing and guesses nothing. Asked by the tree and by the page, so
 *  neither can drift from the other, and a link is dead for an agent exactly
 *  when it is drawn dead. */
const deadSaid = (
  claims: Claims | undefined,
  names: Names | undefined,
  from: string,
  written: string,
): string | undefined => {
  if (claims === undefined || names === undefined) return undefined
  const landing = standardLanding(claims, names.served, from, cut(written))
  return landing === null || !("lookedFor" in landing)
    ? undefined
    : deadLinkSaid({ kind: "path", resolved: landing.lookedFor, suggest: [] })
}

/**
 * The one thing this decides that the path resolver does not is the FRAGMENT.
 * A vault writes `[the bed](garden.md#beds)`, and the path and the anchor are
 * two different questions: the path is a file to resolve, the anchor is what
 * to do once the page is there. So it is cut off before the arithmetic and put
 * back afterwards, verbatim — the walk mints ids per rendered BLOCK
 * (`./ids.ts`), so an anchor into another page is a thing that page will have
 * to answer for, and dropping it here would be this pass deciding it never
 * existed.
 *
 * A link this leaves alone is a link that goes exactly where it says. There is
 * no allowlist to widen and no refusal to draw: the sanitiser has already run
 * (it is the security boundary, and it runs first), an `http:` link is somebody
 * pointing at the internet on purpose — {@link openExternal} is the tab that
 * click opens, not a rewrite of the address — and a relative path to something
 * that is not a document is not this app's to reinterpret.
 *
 * Whether the directory HOLDS the document decides the dead mark and nothing
 * else: `/<anything>.md` stays an address a person may type, because the page
 * model already has a screen that names a document it does not have, and a link
 * quietly left relative would send the reader somewhere with nothing to say at
 * all.
 */
export const resolveDocument = (
  element: Element,
  claims: Claims | undefined,
  names: Names | undefined,
  from: string,
): void => {
  const written = element.properties?.["href"]
  if (typeof written !== "string") return
  // One rule for where a link goes (`@olai/format`'s `placeOf`): the index and
  // the dead-link reading ask it too.
  const place = placeOf(from, cut(written))
  if (place === null || place.kind !== "file") return
  const path = place.path
  const title = element.properties["title"]
  const authored = typeof title === "string" ? title : ""
  const dead = deadSaid(claims, names, from, written)
  // The authored query and fragment ride on after the file, as the link
  // carried them.
  const address = claims === undefined || bodyKind(claims, path) === null ? null : addressOf(claims, path, null)
  const aim: Aim = {
    ...(address === null ? {} : {
      href: "/" + printAddress(address) + (place.query === null ? "" : `?${place.query}`) +
        (place.fragment === null ? "" : `#${place.fragment}`),
    }),
    ...(dead === undefined ? {} : { dead }),
  }
  const { class: classes, ...attributes } = linkDrawing(
    aim,
    // Only a dead link is named after its words, and reading them is a walk
    // over the subtree.
    dead === undefined ? "" : textIn(element).trim(),
    { "data-link-written": written, "data-link-title": authored },
    authored,
  )
  // The classes markdown and the sanitiser left stay; the dead one is added to
  // them, never written over them.
  const classed = element.properties["className"]
  element.properties = { ...element.properties, ...attributes,
    ...(classes === undefined ? {} : { className: [...(Array.isArray(classed) ? classed : []), ...classes.split(" ")] }) }
}

/** The attributes {@link applyLink} writes, so a link that no longer carries
 *  one takes it away. `href` is not among them: a standard link's address is
 *  decided once, by {@link resolveDocument}, and nothing the name index does
 *  can move it. */
const MANAGED = ["data-dead", "aria-label"]

/**
 * A standard link already on the page, brought in step with the directory it
 * now has — in place, so a reader's selection and the open folds around it
 * stay. The marks {@link resolveDocument} left are what it reads: the href as
 * WRITTEN, which with `from` is the whole of the dead question, and the
 * authored title, which the name says after the words and which this must NOT
 * restore onto `title` — markdown's own `title` attribute is in the HTML
 * already and is the document's, not ours. It takes the directory the way
 * `../wikilinks.ts`'s `applyWikilink` does, because both ask one question of
 * it.
 */
export const applyLink = (
  element: HTMLElement,
  claims: Claims | undefined,
  names: Names | undefined,
  from: string,
): void => {
  const written = element.dataset["linkWritten"]
  if (written === undefined) return
  const dead = deadSaid(claims, names, from, written)
  const attributes = linkDrawing(
    dead === undefined ? {} : { dead },
    dead === undefined ? "" : (element.textContent ?? "").trim(),
    {},
    element.dataset["linkTitle"] ?? "",
  )
  for (const key of MANAGED) if (!(key in attributes)) element.removeAttribute(key)
  for (const [key, value] of Object.entries(attributes)) {
    // The link keeps whatever classes the markdown and the sanitiser left it,
    // so the dead one is toggled rather than written over them.
    if (key === "class") continue
    if (element.getAttribute(key) !== value) element.setAttribute(key, value)
  }
  element.classList.toggle(DEAD_LINK, "class" in attributes)
}

/**
 * Send a cross-origin `http:`/`https:` link out of this tab.
 *
 * A click on one of these used to navigate the olai tab away: the href is a
 * real address the browser is happy to follow, and `../../router.tsx`'s
 * `followed` correctly declines it (`routeIn` claims only this app's pages).
 * The address is still the address — this pass does not rewrite it — but the
 * click must not be able to throw the app away. `noopener noreferrer` is the
 * pair that keeps the new tab from holding `window.opener` back at us.
 *
 * Written after the sanitiser, so a note cannot carry a `target` of its own
 * choosing and so a relative `.md` that {@link resolveDocument} has just
 * pointed at its own page is not stamped. Everything else — a fragment, a path
 * that is not a document, an app `<Link>` this walk never sees — is untouched.
 */
export const openExternal = (element: Element): void => {
  const href = element.properties?.["href"]
  if (typeof href !== "string" || !isHttp(href)) return
  element.properties = {
    ...element.properties,
    target: "_blank",
    rel: ["noopener", "noreferrer"],
  }
}

/** A fully-qualified `http:` or `https:` URL, and nothing else. A relative
 *  path, a fragment, `mailto:`, a protocol-relative `//host` — none of these
 *  leave the origin the way a pasted web address does, and none are stamped. */
const isHttp = (href: string): boolean => /^https?:\/\//i.test(href)
