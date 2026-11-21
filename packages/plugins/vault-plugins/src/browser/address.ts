/**
 * `/plugins/<word>` AND EVERYTHING UNDER IT — the grammar alone, with no JSX,
 * so a test at the root reads it without a browser build (`./route.ts` joins
 * it to the page's glyph).
 *
 * Three pages share the prefix:
 *
 *   - `/plugins/<word>` is the approval page, where the plugin is read and
 *     turned on. It is ALWAYS that page: no plugin face is ever drawn there,
 *     whatever a plugin registers.
 *   - `/plugins/<word>/<file>` is the same page opened at one of the folder's
 *     files — its README or any code file at any depth (`@olai/surface`'s
 *     `isPluginCode`), the rule the folder reader keeps.
 *   - `/plugins/<word>/app` and `/plugins/<word>/app/<rest>` is the plugin's
 *     OWN page, drawn by the plugin's `plugin.page` face, handed `rest`.
 *
 * A FILE WINS over `app`. `app/review.ts` is a code file the folder could
 * hold, so it opens the approval page at that file: a person following a link
 * to a file of the plugin is always shown that file, never something the file
 * draws. Whether the folder holds it is the page's question, not the grammar's.
 */

import { isPluginCode, PLUGIN_README_FILE, WORD } from "@olai/surface"
import { PLUGIN_PATH } from "../index.ts"

/** The segment under a word that the plugin's own page lives below. */
export const OWN_PAGE = "app"

/**
 * One address under the prefix: the folder's word, and — where the address
 * named one of the folder's files — which file to open the approval page at,
 * or — where it named the plugin's own page — the rest of the path below `app`.
 */
export type PluginPage =
  | { readonly word: string; readonly file?: string; readonly app?: undefined }
  | { readonly word: string; readonly app: string; readonly file?: undefined }

export const parsePluginPage = (pathname: string): PluginPage | null => {
  if (!pathname.startsWith(PLUGIN_PATH)) return null
  let rest: string
  try { rest = decodeURIComponent(pathname.slice(PLUGIN_PATH.length)) } catch { return null }
  const cut = rest.indexOf("/")
  const word = cut === -1 ? rest : rest.slice(0, cut)
  if (!WORD.test(word)) return null
  if (cut === -1) return { word }
  const file = rest.slice(cut + 1)
  if (file === PLUGIN_README_FILE || isPluginCode(file)) return { word, file }
  if (file === OWN_PAGE) return { word, app: "" }
  if (file.startsWith(`${OWN_PAGE}/`)) return { word, app: file.slice(OWN_PAGE.length + 1) }
  return null
}

const segments = (path: string): string => path.split("/").map(encodeURIComponent).join("/")

export const pluginPageHref = (page: PluginPage): `/${string}` => {
  const at = `${PLUGIN_PATH}${encodeURIComponent(page.word)}`
  if (page.app !== undefined) return `${at}/${OWN_PAGE}${page.app === "" ? "" : `/${segments(page.app)}`}` as `/${string}`
  return `${at}${page.file === undefined ? "" : `/${segments(page.file)}`}` as `/${string}`
}

/**
 * The crumb is the WORD and not the title, and that is a limit worth being
 * plain about: a breadcrumb is drawn from the address alone, and the title is
 * the README's — a fact about the folder, which this grammar has never read.
 * The page itself heads with the title.
 */
export const pluginPageCrumb = (page: PluginPage): string =>
  page.app !== undefined
    ? `${page.word}${page.app === "" ? "" : ` › ${page.app}`}`
    : `Plugins › ${page.word}${page.file === undefined ? "" : ` › ${page.file}`}`
