/**
 * WHAT A BROWSER MAY FETCH — the fetch rule, read off the claims beside
 * `./kinds.ts`: which paths markdown may draw as a picture, which a page may
 * fetch as one of its parts, and how a served file is answered.
 *
 * It is a statement about what a suffix MEANS, which is this package's
 * business, and it is asked by the media route and the attach rule as well as
 * by markdown — so it lives here rather than in the link file, where it sat
 * beside a question it is not part of.
 */
import { type Claims, isFetched } from "./kinds.ts"

/** Whether a path ends in one of these suffixes, case-folded — the matching
 *  RULE, held once for the two lists below it. Case-folding, exact suffix, no
 *  dot boundary: two allowlists answering the same shape of question should not
 *  be two chances to refine one of them and not the other. */
const suffixed = (path: string, extensions: ReadonlyArray<string>): boolean => {
  const lower = path.toLowerCase()
  return extensions.some((extension) => lower.endsWith(extension))
}

/**
 * Whether Markdown may draw this path as an inline picture.
 *
 * READ OFF THE CLAIMS: `picture` admits the case-folded suffix, and `inert`
 * excludes suffixes that must not become inline pictures. A picture used to
 * be the one thing under the served directory that was neither an outline nor a document — nothing loaded one,
 * nothing validated one, and one existed only as the target of a relative
 * `![](…)` — so this was a closed allowlist typed out here. A picture is a
 * KIND now (`./kinds.ts`): it is in the set, it is in the sidebar, and it has a
 * page. Two hand-kept lists of the same suffixes would be two chances to add
 * `.heic` to one of them, and the way that reads is a file the sidebar draws
 * and a document cannot point at, or the reverse.
 *
 * The image row declares `.svg` inert, preserving the ruling
 * (`@olai/surface`'s `attach.ts` keeps the same one for what may be handed to
 * an agent): an SVG is a document that can script, and markdown pointing at one
 * is this app promising to draw a file it has not read. That the kind claims
 * `.svg` is not the same permission — a picture's PAGE draws it in an `<img>`,
 * which is the element that will not run it, and the response it is fetched
 * with says so too (the vault's `http/media.ts`).
 */
export const isPicture = (claims: Claims, path: string): boolean => {
  const lower = path.toLowerCase()
  return [...claims.byKind.values()].some(claim => claim.picture === true &&
    suffixed(lower, claim.exts) && !suffixed(lower, claim.inert ?? []))
}

/** Serving policy comes from the current claim, including case-folded images. */
export const servingOf = (claims: Claims, path: string): { sealed: boolean; inert: boolean } => {
  const claim = [...claims.byKind.values()].find(claim =>
    claim.exts.some(ext => path.endsWith(ext) || (claim.picture === true && path.toLowerCase().endsWith(ext))))
  return { sealed: claim?.serving === "sealed-frame", inert: suffixed(path, claim?.inert ?? []) }
}

/**
 * The extensions a PAGE may fetch, beyond the pictures above — the parts a
 * saved `.html` is made of.
 *
 * A second allowlist rather than a widening of the first, because the two
 * answer different questions and only one of them is markdown's. A relative
 * `![](…)` may name a picture and nothing else; that rule is unchanged and
 * {@link isPicture} is still the whole of it. What is new is that a previewed
 * `.html` is now fetched BY URL and draws itself with its own parts — the
 * stylesheet it was saved beside, the script it was built with, the font it
 * embeds — and a preview that drew a page's pictures but refused its
 * stylesheet would be a rule nobody could explain.
 *
 * A CLOSED LIST, and what is missing from it is the argument. Data (`.json`,
 * `.csv`) stays out because a page reading data is a page reading FILES, which
 * is a different permission from a page drawing itself, and nothing has forced
 * the question — a `.csv` being a KIND now did not force it either, since that
 * kind's own page is handed the text over the wire and never fetches this
 * route. Everything the set itself is made of — `.olai`, `.md` — stays out
 * because those already have a page of their own, and a route that also handed
 * them over raw would be a second way to read them with no argument for the
 * first.
 *
 * `.svg` USED TO BE HERE AS AN ABSENCE and is now the registry's business: it
 * is one of the picture kind's suffixes, so {@link isAsset} admits it below,
 * and what stops a previewed page pulling one into a frame and running it is
 * the response that answers it rather than a suffix withheld here
 * (the vault's `http/media.ts` sandboxes an SVG's own response). Withholding
 * it here would also have withheld it from the `<img>` a picture's PAGE draws,
 * which is the one thing the ruling never meant to stop.
 *
 * The kinds a browser fetches are NOT here either: which suffixes those are is
 * `./kinds.ts`'s single answer, and {@link isAsset} asks it there.
 *
 * This companion-asset list is module-private because nothing outside needs
 * the LIST — the route asks {@link isAsset} a question and gets a
 * yes or a no. A second exported list would be a second thing to keep in step
 * for no reader.
 */
const ASSET_EXTENSIONS: ReadonlyArray<string> = [
  ".css",
  ".js",
  ".mjs",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
]

/**
 * Whether a served path is something a browser may fetch: a file whose PAGE is
 * drawn by pointing at it, or one of the parts a saved page draws itself with.
 *
 * The one predicate the media route judges a request by, and the reason it is
 * here rather than at the route: it is a statement about what a suffix MEANS,
 * which is this package's business, and the route is in a package the client
 * cannot import (`@olai/surface` carries the URL shape, `@olai/server`
 * answers it).
 *
 * THE FIRST TERM IS THE REGISTRY'S COLUMN ({@link isFetched}) rather than a
 * kind named here, and that is what kept this predicate one line while the
 * viewers arrived: hypertext, a picture and a `.pdf` are drawn by a frame, an
 * `<img>` and an `<embed>` pointed at the file's own URL, and a `.csv` — text,
 * unkept, and still handed to its page over the wire — is not. Which of those
 * is which is one column of one table, not a list to keep in step over here.
 *
 * The SECOND term is not redundant with the first, and the difference is one
 * character of case: the registry matches a suffix exactly, so `SHOT.PNG` is a
 * file no kind claims, while {@link isPicture} has case-folded since before
 * there was a picture kind — and a document naming one has always drawn it.
 */
export const isAsset = (claims: Claims, path: string): boolean =>
  isFetched(claims, path) || isPicture(claims, path) || suffixed(path, ASSET_EXTENSIONS)
