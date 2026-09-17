import { definePlugin } from "@olai/plugin-api"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { Effect } from "effect"
import { fileKinds } from "olai-plugin-files/contract"
import { pages, navigation } from "olai-plugin-navigation/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { fileAccess } from "olai-plugin-vault/contract"
import { BodyPage } from "olai-plugin-markdown/body-page"
import { referrerMemory } from "olai-plugin-markdown/contract"
import { claim, name } from "./claim.ts"
import { KindGlyph } from "./glyph.tsx"
import { TESTID } from "./testids.ts"
import { Hypertext } from "./browser/Hypertext.tsx"
import { holdServed } from "./browser/vault.ts"
import { fileLinks } from "olai-plugin-navigation/contract"
import { holdOpens } from "./browser/links.ts"
import { referrerMemoryChannel } from "@olai/ui-primitives/referrer-memory.ts"
// THE CHANNEL to the section's memory, factory-minted HERE (a package calls
// it once; `@olai/ui-primitives/referrer-memory.ts`'s `referrerMemoryChannel`
// says why it is a factory rather than a module-scope holder). The `referrers`
// component below holds through it; this row's `page` reads through it.
const channel = referrerMemoryChannel()
const by = { kind: name } as const
export default definePlugin({ name, needs: [], apply: Effect.void })
export const components = {
  glyph: definePlugin({ name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph: KindGlyph, noun: claim.noun, article: claim.article, testid: TESTID.hypertextLink }, { key: fileKindKey(by) })
  }) }),
  /** The referrers section's open-state memory, DECLARED — a component of its
   *  own so a hypertext page still draws when the markdown row is off (the
   *  `document-properties` pattern): this component sits `waiting`, the page
   *  reads the empty answer (collapsed section) rather than this row turning
   *  off with it (the `channel` below, minted from
   *  `@olai/ui-primitives/referrer-memory.ts`'s `referrerMemoryChannel`). */
  referrers: definePlugin({ name: "referrers", needs: [referrerMemory], apply: Effect.gen(function*() {
    const memory = yield* referrerMemory
    yield* Effect.acquireRelease(Effect.sync(() => channel.hold(memory)), stop => Effect.sync(stop))
  }) }),
  page: definePlugin({ name: "page", needs: [rendererSlots, navigation, fileAccess, fileLinks], apply: Effect.gen(function*() {
    const slots = yield* rendererSlots, nav = yield* navigation, directory = yield* fileAccess
    yield* Effect.acquireRelease(Effect.sync(() => holdServed(directory)), stop => Effect.sync(stop))
    const opens = yield* fileLinks
    yield* Effect.acquireRelease(Effect.sync(() => holdOpens(opens)), stop => Effect.sync(stop))
    yield* slots.contribute(pages, { by, edits: false, page: () => <BodyPage navigation={nav} directory={directory} memory={channel.read()} Body={Hypertext} /> }, { key: fileKindKey(by) })
  }) }),
}
