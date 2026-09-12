import { definePlugin } from "@olai/plugin-api"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { Effect } from "effect"
import { fileKinds } from "olai-plugin-files/contract"
import { pages, navigation } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { fileAccess } from "olai-plugin-vault/contract"
import { browserState } from "olai-plugin-markdown/contract"
import { BodyPage } from "olai-plugin-markdown/body-page"
import { claim, name } from "./claim.ts"
import { KindGlyph } from "./glyph.tsx"
import { TESTID } from "./testids.ts"
import { Csv } from "./browser/Csv.tsx"
import { holdServed } from "./browser/vault.ts"

const by = { kind: name } as const
export default definePlugin({ name, needs: [], apply: Effect.void })
export const components = {
  glyph: definePlugin({ name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph: KindGlyph, noun: claim.noun, article: claim.article, testid: TESTID.csvLink }, { key: fileKindKey(by) })
  }) }),
  page: definePlugin({ name: "page", needs: [rendererSlots, navigation, fileAccess, browserState], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots, nav = yield* navigation, directory = yield* fileAccess, browser = yield* browserState
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(directory)), stop => Effect.sync(stop))
    yield* slots.contribute(pages, { by, edits: false, page: () => <BodyPage navigation={nav} directory={directory} browser={browser} Body={Csv} /> }, { key: fileKindKey(by) })
  }) }),
}
