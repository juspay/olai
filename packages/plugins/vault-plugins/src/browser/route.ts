import { defineSelfDrawnRoute } from "olai-plugin-navigation/routes"

import { PLUGIN_FILES, WORD } from "@olai/surface"
import { PLUGIN_PATH } from "../index.ts"
import { PluginGlyph } from "./glyph.tsx"

export { PLUGIN_PATH }

export interface PluginPage {
  readonly word: string
  readonly file?: string
}

export const pluginPage = defineSelfDrawnRoute<PluginPage>({
  claims: [{ kind: "prefix", path: PLUGIN_PATH }],
  parse: (pathname) => {
    let rest: string
    try { rest = decodeURIComponent(pathname.slice(PLUGIN_PATH.length)) } catch { return null }
    const cut = rest.indexOf("/")
    const word = cut === -1 ? rest : rest.slice(0, cut)
    if (!WORD.test(word)) return null
    if (cut === -1) return { word }
    const file = rest.slice(cut + 1)
    return PLUGIN_FILES.some((held) => held === file) ? { word, file } : null
  },
  href: ({ word, file }) =>
    `${PLUGIN_PATH}${encodeURIComponent(word)}${file === undefined ? "" : `/${encodeURIComponent(file)}`}`,
  breadcrumb: ({ word, file }) => `Plugins › ${word}${file === undefined ? "" : ` › ${file}`}`,
  narrowable: false,
  glyph: PluginGlyph,
})
