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

import { PLUGIN_PATH } from "../index.ts"
import { parsePluginPage, type PluginPage, pluginPageCrumb, pluginPageHref } from "./address.ts"
import { PluginGlyph } from "./glyph.tsx"

/** The prefix this page claims. Trailing slash, so `/plugins` itself is not
 *  ours: a list of plugins is the panel's and the sidebar's job, and claiming
 *  the bare word would take an address away from a page that might want it.
 *  It is the package's own (`../index.ts`), because the serve spells this URL
 *  too now: a chat about a plugin is a chat about this page. */
export { PLUGIN_PATH }

/**
 * One plugin's page: the folder's word, and — where the address named one of
 * the folder's files — which of them to open at, or — under `app` — the
 * plugin's own page and the rest of its path (`./address.ts`).
 *
 * ## A HALF'S PATH IS THIS PAGE'S ADDRESS, and that is why the value has a
 * `file`
 *
 * `plugins/hex-swatch/server.ts` is a real file in the set: the Commit panel
 * lists it, the ledger records it, a link can name it. What it has no page of
 * its own is deliberate (the claim's `elsewhere`, and the sidebar rule it
 * carries) — so an address that named one used to fall through every grammar
 * and leave the pane drawing whatever it had been drawing, which is the one
 * answer worse than a refusal.
 *
 * It opens the PLUGIN's page with that file showing. That is where a half is
 * read on purpose: with the README over it, what it uses beside it, and the
 * one button that decides whether it runs.
 */
export type { PluginPage }

export const pluginPage = defineSelfDrawnRoute<PluginPage>({
  claims: [{ kind: "prefix", path: PLUGIN_PATH }],
  parse: parsePluginPage,
  href: pluginPageHref,
  breadcrumb: pluginPageCrumb,
  narrowable: false,
  // The square the column and the page head with, so a chat about this page
  // wears it wherever the chat is named.
  glyph: PluginGlyph,
})
