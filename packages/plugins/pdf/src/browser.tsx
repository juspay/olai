import { definePlugin } from "@olai/plugin-api"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { Effect } from "effect"
import { pages, navigation } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { fileAccess } from "olai-plugin-vault/contract"
import { referrerMemory } from "olai-plugin-markdown/contract"
import { BodyPage } from "olai-plugin-markdown/body-page"
import { claim, name } from "./claim.ts"
import { KindGlyph } from "./glyph.tsx"
import { glyphComponent } from "./browser/glyph.ts"
import { Pdf } from "./browser/Pdf.tsx"
import { holdServed } from "./browser/vault.ts"
import { holdReferrersMemory, useReferrersMemory } from "./browser/memory.ts"

const by = { kind: name } as const
export default definePlugin({ name, needs: [], apply: Effect.void })
export const components = {
  glyph: glyphComponent(KindGlyph),
  /** The referrers section's open-state memory, DECLARED — a component of its
   *  own so a pdf page still draws when the markdown row is off (the
   *  `document-properties` pattern): this component sits `waiting`, the page
   *  reads the empty answer (collapsed section) rather than this row turning
   *  off with it (`./browser/memory.ts`). */
  referrers: definePlugin({ name: "referrers", needs: [referrerMemory], apply: Effect.gen(function*() {
    const memory = yield* referrerMemory
    yield* Effect.acquireRelease(Effect.sync(() => holdReferrersMemory(memory)), stop => Effect.sync(stop))
  }) }),
  page: definePlugin({ name: "page", needs: [rendererSlots, navigation, fileAccess], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots, nav = yield* navigation, directory = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(directory)), stop => Effect.sync(stop))
    yield* slots.contribute(pages, { by, edits: false, page: () => <BodyPage navigation={nav} directory={directory} memory={useReferrersMemory()} Body={Pdf} /> }, { key: fileKindKey(by) })
  }) }),
}
