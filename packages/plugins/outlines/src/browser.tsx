import { Wired } from "@olai/plugin-api"
import { holdClient, type Client } from "./client.ts"
import { registerWriter } from "@olai/edit-history/writing.ts"
import { dispatch } from "./surface.ts"
import { writeEdit } from "@olai/edit-history/writing.ts"
import { slotContracts } from "./slots.ts"
import { fileKind } from "@olai/format"
import {Clocks} from "@olai/plugin-api"
/** Outlines owns editor history, selection/drag registers, page readings and
 * browser preferences. These resources live in the provider activation, before
 * and independently of any layout. Content and settings are separate consumers. */
import { definePlugin, Faces, Offers } from "@olai/plugin-api"
import { holdFaces } from "./browser/faces.ts"
import { holdLocations } from "./browser/locations.ts"
import { readings } from "olai-plugin-search/reading"
import { holdReading } from "./browser/search.ts"
import { shell as layoutShell } from "olai-plugin-layout/contract"
import { holdShell } from "./browser/shell.ts"
import { Effect } from "effect"
import { createRoot } from "solid-js"
import { rendererSlots } from "olai-plugin-ui-renderer/contract"
import { navigation, content } from "olai-plugin-navigation/contract"
import {fileAccess} from "olai-plugin-vault/contract"
import { fileTypes, fileState } from "olai-plugin-files/contract"
import { NewOutline } from "./browser/outline/NewOutline.tsx"
import { sections } from "olai-plugin-preferences/contract"
import { name, browserState, datedRows, documentReferences, pageView, titles, propertyRoutes, type OutlinesBrowser } from "./index.ts"
import type { References } from "./contracts/references.ts"
import { openOverlaySocket, overlayRoot } from "./browser/overlay.ts"
import { createDeclared, declaringFailure, clearDeclared } from "./browser/declared.ts"
import { useShowNode, clearFocus } from "./browser/focus.ts"
import { createUndo, holdUndo } from "./browser/edit/undoing.ts"
import { createReadings, holdReadings } from "./browser/reading.tsx"
import { createAir, holdAir } from "./browser/drag/air.ts"
import { createFields, holdFields } from "./browser/drag/fields.ts"
import { clearRowForms } from "./browser/date/memory.tsx"
import { clearBacklinks } from "./browser/backlinks/Backlinks.tsx"
import { clearEditorMemory } from "./browser/edit/memory.ts"
import { followDensity } from "./browser/settings/density.ts"
import { followDonePrefs } from "./browser/settings/done.ts"
import { followFolds } from "./browser/fold/memory.ts"
import { createRefiling } from "./browser/fold/refiling.ts"
import { NodeTitle } from "./browser/NodeTitle.tsx"
import { atFile } from "olai-plugin-navigation/routes"
import { DatedRow } from "./browser/DatedRow.tsx"
import { OutlinePageView } from "./browser/PageView.tsx"
import { PreferenceRows } from "./browser/PreferenceRows.tsx"
import { runAsync } from "@olai/web/client/run.ts"
import { connectionReadout } from "@olai/web/client/wire.ts"
import { client } from "./client.ts"
import { reachable } from "@olai/web/client/connection/reaching.ts"

/**
 * WHAT THIS ROW OWNS IN A TAB, built once and OFFERED — not announced.
 *
 * `browser-state` used to be `Offers.own("browser-state", () => ({}))`: a
 * service carrying nothing at all, while every value it is named after went
 * into a module variable beside it. Cordis saw the announcement and none of the
 * consumers, which is the audit's §2 in one line.
 *
 * The values are on the service now — the sibling client, the undo stack, the
 * page readings, the two drag registers, this row's own naming of a node and
 * the overlay socket — so a consumer that named `outlines.browser-state` is
 * handed the state rather than a permission to go and find it.
 *
 * THE PRIVATE HOLDERS STAY, and they are the same activation's. A face three
 * levels inside a row cannot be handed an `apply`'s value, and each of those
 * holders installs exactly what is offered here and clears it by identity when
 * this scope closes — which is what makes them helpers rather than a second
 * ownership. What they are NOT is a door: none of them is exported through this
 * package's contracts, so no other package can reach one, and
 * `@olai/bundle`'s fence holds that.
 *
 * `outlines.references` is offered BESIDE it rather than folded into it,
 * because its consumer is a different package with a different lifetime: the
 * chat panel wants the naming of a node and must not be taken away when this
 * row stops (`./contracts/references.ts`).
 */
export default definePlugin({ name, needs: [Wired, Offers], apply: Effect.gen(function*() {
  const ownWire = yield* Wired
  yield* Effect.acquireRelease(Effect.sync(() => holdClient(() => ownWire.client() as Client)), stop => Effect.sync(stop))
  yield* Effect.acquireRelease(Effect.sync(() => registerWriter(dispatch["edit.apply"], edit => (ownWire.client() as Client).procedures.edit.apply(edit))), stop => Effect.sync(stop))

  for (const start of [followDensity, followDonePrefs, followFolds]) {
    yield* Effect.acquireRelease(Effect.sync(start), stop => Effect.sync(stop))
  }
  const state = yield* Effect.acquireRelease(Effect.sync(() => createRoot(dispose => {
    const references: References = { declare: createDeclared, showNode: useShowNode, failure: declaringFailure }
    const undo = createUndo(edit => runAsync(writeEdit(edit)))
    const readings = createReadings()
    const fields = createFields()
    const air = createAir()
    const stops = [holdUndo(undo), holdReadings(readings), holdFields(fields), holdAir(air),
      openOverlaySocket()]
    createRefiling({ ask: request => runAsync(client().procedures.nodes.homes(request)),
      reachable: () => reachable(connectionReadout()) })
    return {
      value: { client, undo, readings, fields, air, references, overlay: overlayRoot } satisfies OutlinesBrowser,
      dispose: () => { dispose(); for (const stop of stops) stop(); clearEditorMemory(); clearRowForms(); clearBacklinks(); clearFocus(); clearDeclared() },
    }
  })), state => Effect.sync(state.dispose))
  const offers = yield* Offers
  yield* offers.own("browser-state", () => state.value)
  yield* offers.own("references", () => state.value.references)
}) })

import { documentProperties } from "./browser/document-properties.tsx"
import { palette, messages } from "./browser/palette/adapter.tsx"
export const components = {
  palette, messages, "document-properties": documentProperties,
  /** The shell's geometry, DECLARED — a component of its own because content
   *  runs under another layout entirely (`olai-plugin-test-layout`), so a row
   *  that waited for this one could not (`./browser/shell.ts`). */
  shell: definePlugin({ name: "shell", needs: [layoutShell], apply: Effect.gen(function*() {
    const geometry = yield* layoutShell
    yield* Effect.acquireRelease(Effect.sync(() => holdShell(geometry)), stop => Effect.sync(stop))
  }) }),
  content: definePlugin({ name: "content", needs: [browserState, rendererSlots, navigation, fileAccess, Clocks, Faces], apply: Effect.gen(function*() {
    // The row doors, row verbs and kind dressings other plugins hang — held for
    // this activation, which is the one that draws every page they appear on
    // (`./browser/faces.ts`).
    yield* holdFaces(yield* Faces)
    const slots = yield* rendererSlots
    // ...and the walks over the locations this page draws, from the same
    // renderer (`./browser/locations.ts`).
    yield* Effect.acquireRelease(Effect.sync(() => holdLocations(slots.read)), stop => Effect.sync(stop))
    yield* slots.contribute(content, {
      matches: route => route.kind === "plugin" || (route.kind === "at" && (route.address === null || route.address.kind === "node" || fileKind(route.address.path) === "outline")),
      Page: () => <OutlinePageView />,
    }, { children: [...Object.values(slotContracts), datedRows, documentReferences, pageView, titles, propertyRoutes] })
    yield* slots.contribute(datedRows, DatedRow)
    yield* slots.contribute(pageView, OutlinePageView)
    yield* slots.contribute(titles, NodeTitle)
    yield* slots.contribute(propertyRoutes, meaning => meaning.kind === "document" && fileKind(meaning.file) === "outline" ? atFile(meaning.file) : undefined)
  }) }),
  /** The matcher, DECLARED — a component of its own so the outline keeps
   *  editing and navigating when the row leaves, and its completions and
   *  shortlists say *no matcher* rather than disappearing
   *  (`./browser/search.ts`). */
  search: definePlugin({ name: "search", needs: [readings], apply: Effect.gen(function*() {
    const reading = yield* readings
    yield* Effect.acquireRelease(Effect.sync(() => holdReading(reading)), stop => Effect.sync(stop))
  }) }),
  files: definePlugin({ name: "files", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(fileTypes, { Create: NewOutline })
  }) }),
  preferences: definePlugin({ name: "preferences", needs: [browserState, rendererSlots], apply: Effect.gen(function*() {
    yield* (yield* rendererSlots).contribute(sections, PreferenceRows)
  }) }),
}

export { surface } from "./surface.ts"
