/**
 * `/plugins/<word>` — ONE PLUGIN'S OWN PAGE, as an address.
 *
 * ## Why a plugin has a page at all
 *
 * Because it is a thing in somebody's vault, and everything else in a vault
 * has one. A plugin somebody asked for is not a row in a settings panel that
 * happens to have a switch: it is a folder with a README, three files, a
 * conversation that built it and a decision somebody has to make about code.
 * None of that fits under a disclosure triangle in a list of forty rows, and
 * the one gesture it exists for — reading source and saying yes to it — is the
 * most consequential press in this product.
 *
 * An ADDRESS, so it can be linked: the sidebar's row is an anchor, an alert's
 * press is a navigation, and the palette's *New plugin* answers with a place to
 * go rather than with a modal that has to stay open. That is also why the
 * grammar is here, in a module of its own, rather than inside the component:
 * three faces spell this URL and only one of them draws it.
 *
 * ## The word is the whole of the value
 *
 * The folder's name identifies the plugin everywhere else — it is the row's
 * `name`, the settings namespace and the slot key — so the address carries it
 * and nothing else. The grammar is checked here (`WORD`, this row's own, read
 * from the module that defines it rather than spelled a second time) so a path
 * that is not a word parses as no page at all and navigation falls through to
 * whatever else claims it, instead of mounting a page that then has to explain
 * itself. A word with no folder behind it DOES parse — that is a plugin
 * somebody deleted, or a link from another vault, and the page's own
 * *no such plugin* arm is the honest answer to it.
 *
 * NOT NARROWABLE. `?q=` means *show me less of this page*, and the page is one
 * plugin: there is nothing to filter and a box offering to would be a control
 * that does nothing.
 */

import { defineSelfDrawnRoute } from "olai-plugin-navigation/routes"

import { WORD } from "../source.ts"

/** The prefix this page claims. Trailing slash, so `/plugins` itself is not
 *  ours: a list of plugins is the panel's and the sidebar's job, and claiming
 *  the bare word would take an address away from a page that might want it. */
export const PLUGIN_PATH = "/plugins/"

/** One plugin's page: the folder's word, and nothing else. */
export interface PluginPage {
  readonly word: string
}

export const pluginPage = defineSelfDrawnRoute<PluginPage>({
  claims: [{ kind: "prefix", path: PLUGIN_PATH }],
  parse: (pathname) => {
    let word: string
    try { word = decodeURIComponent(pathname.slice(PLUGIN_PATH.length)) } catch { return null }
    return WORD.test(word) ? { word } : null
  },
  href: ({ word }) => `${PLUGIN_PATH}${encodeURIComponent(word)}`,
  // The crumb is the WORD and not the title, and that is a limit worth being
  // plain about: a breadcrumb is drawn from the address alone, and the title
  // is the README's — a fact about the folder, which this grammar has never
  // read. The page itself heads with the title.
  breadcrumb: ({ word }) => `Plugins › ${word}`,
  narrowable: false,
})
