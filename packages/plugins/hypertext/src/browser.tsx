import { definePlugin } from "@olai/plugin-api"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { Effect } from "effect"
import { fileKinds } from "olai-plugin-files/contract"
import { pages } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { fileAccess } from "olai-plugin-vault/contract"
import { BodyPage } from "olai-plugin-markdown/body-page"
import { referrerMemory } from "olai-plugin-markdown/contract"
import { claim, name } from "./claim.ts"
import { KindGlyph } from "./glyph.tsx"
import { TESTID } from "./testids.ts"
import { Hypertext } from "./browser/Hypertext.tsx"
import { holdServed } from "./browser/vault.ts"
import { navigation } from "olai-plugin-navigation/contract"
import { referrerMemoryChannel } from "@olai/ui-primitives/referrer-memory.ts"
const channel = referrerMemoryChannel()
const by = { kind: name } as const
export default definePlugin({ name, needs: [], apply: Effect.void })
export const components = {
  glyph: definePlugin({ name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph: KindGlyph, noun: claim.noun, article: claim.article, testid: TESTID.hypertextLink }, { key: fileKindKey(by) })
  }) }),
  referrers: definePlugin({ name: "referrers", needs: [referrerMemory], apply: Effect.gen(function*() {
    const memory = yield* referrerMemory
    yield* Effect.acquireRelease(Effect.sync(() => channel.hold(memory)), stop => Effect.sync(stop))
  }) }),
  page: definePlugin({ name: "page", needs: [rendererSlots, fileAccess, navigation], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots, directory = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(directory)), stop => Effect.sync(stop))
    yield* slots.contribute(pages, { by, edits: false, page: () => <BodyPage directory={directory} memory={channel.read()} Body={Hypertext} /> }, { key: fileKindKey(by) })
  }) }),
}
