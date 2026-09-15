/**
 * The org row's face in the tab: ONE contribution, the sidebar glyph that
 * says a `.org` line is an outline in its own spelling.
 *
 * Everything else an outline needs in a browser — the page, the tree, the
 * new-outline door — is `olai-plugin-outlines`' and holds kind-blind: the
 * claim says `holds: "nodes"` and its formats make the bytes. Keyed by kind
 * rather than `holds`, this contribution overrides that row's general
 * drawing for exactly the files this one claims (`forFileClaim`); with this
 * component absent, its files wear the general outline drawing, which is the
 * fallback's job rather than a reason to draw less.
 */
import { definePlugin } from "@olai/plugin-api"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { Effect } from "effect"
import { fileKinds } from "olai-plugin-files/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { claim, name } from "./claim.ts"
import { KindGlyph } from "./glyph.tsx"
import { TESTID } from "./testids.ts"

const by = { kind: name } as const
export default definePlugin({ name, needs: [], apply: Effect.void })
export const components = {
  glyph: definePlugin({ name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph: KindGlyph, noun: claim.noun, article: claim.article, testid: TESTID.outlineOrgLink }, { key: fileKindKey(by) })
  }) }),
}
