import { definePlugin } from "@olai/plugin-api"
import { fileKindKey } from "@olai/plugin-api/file-kinds"
import { Effect } from "effect"
import type { JSX } from "solid-js"
import { fileKinds } from "olai-plugin-files/contract"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { claim, name } from "../claim.ts"
import { TESTID } from "../testids.ts"
export const glyphComponent = (glyph: () => JSX.Element) => definePlugin({
  name: "glyph", needs: [rendererSlots], apply: Effect.gen(function*() {
    const by = { kind: name }
    yield* (yield* rendererSlots).contribute(fileKinds, { by, glyph, noun: claim.noun, article: claim.article, testid: TESTID.pdfLink }, { key: fileKindKey(by) })
  }),
})
