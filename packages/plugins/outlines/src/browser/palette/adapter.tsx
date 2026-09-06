/** Outline palette commands consume outline state; navigation only dispatches
 * their opaque requests. A missing outline retracts both commands and writes. */
import { createMemo, createRoot, createEffect, on } from "solid-js"
import { Effect, Schema } from "effect"
import { Edit } from "@olai/surface"
import { definePlugin, Slots } from "@olai/plugin-api"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { navigation, paletteAdapters } from "olai-plugin-navigation/contract"
import { browserState } from "../../index.ts"
import { useUndo } from "../edit/undoing.ts"
import { UndoSaid } from "../edit/UndoSaid.tsx"
import { useReadings } from "../reading.tsx"
import { opItems } from "./ops.ts"
import { applying } from "@olai/web/client/writes.ts"
import { only } from "@olai/web/client/narrow.ts"
import { fileOf } from "../page.ts"
import { doneHiddenOn, setDoneFor, pageFileOf } from "../settings/done.ts"

export const palette = definePlugin({ name: "palette", needs: [browserState, rendererSlots, navigation], apply: Effect.gen(function*() {
  const nav = yield* navigation
  const undo = useUndo()
  const readings = useReadings()
  const focused = () => readings.at(nav.workspace().focus)?.shows
  const slots = yield* rendererSlots
  yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const file = createMemo(() => { const shows = focused(); return shows === undefined ? undefined : fileOf(shows) })
    createEffect(on(file, () => undo.clear(), {defer:true}))
    return dispose
  })), dispose => Effect.sync(dispose))
  yield* slots.contribute(paletteAdapters, {
    items: () => {
      const shows = focused()
      const zoomed = shows === undefined ? undefined : only(shows, "node")?.zoomed
      const node = zoomed?.kind === "node" ? zoomed : undefined
      return opItems(node, node?.under)
    },
    accepts: request => Schema.is(Edit)(request) && !["doc", "docNew", "pin", "capture"].includes(request.verb),
    write: request => applying(Schema.decodeUnknownSync(Edit)(request), undo.record),
    key: action => {
      if (action === "undo") undo.undo()
      else if (action === "redo") undo.redo()
      else if (action === "done") { const file = pageFileOf(focused()); if (file !== undefined) setDoneFor(file, doneHiddenOn(file) ? "shown" : "hidden") }
    },
  })
}) })
export const messages = definePlugin({ name: "messages", needs: [browserState, Slots], apply: Effect.gen(function*() {
  const undo = useUndo()
  yield* (yield* Slots).register("app.banner", () => <UndoSaid said={undo.said()} />)
}) })
