/**
 * A PLUGIN-DRAWN FILE PAGE KEEPS ITS IDENTITY while the slot table moves for
 * any other reason.
 *
 * The table's reading is tracked on the renderer's one signal, which moves when
 * a face arrives or leaves in ANY slot. `./PageView.tsx` draws the chosen page
 * through a keyed `<Show>`, so a page object minted afresh on every reading is
 * a page unmounted and mounted again — its scroll, its selection and any read
 * it had in flight thrown away because some other plugin hung a chip. What is
 * held here is the object the keyed `<Show>` is keyed by: one per
 * registration, for as long as that registration stands.
 *
 * Under the browser condition because the subject is a memo, and a
 * server-resolved Solid never recomputes one.
 */
import { expect, test } from "bun:test"
import type { Hung } from "@olai/plugin-api"
import { createRoot, createSignal } from "solid-js"

import { filePagesOver } from "./file-pages.ts"
import type { FilePageFace } from "./slots.ts"

test("one page per registration, the same object while other faces come and go", () => {
  createRoot((dispose) => {
    const reader: Hung<FilePageFace> = { plugin: "reader", face: () => null }
    const other: Hung<FilePageFace> = { plugin: "other", face: () => null }
    const [table, setTable] = createSignal<ReadonlyArray<Hung<FilePageFace>>>([reader])
    const pages = filePagesOver(table, () => null)
    const held = pages()[0]
    expect(held?.by).toEqual({ kind: "reader" })

    // ANOTHER PLUGIN registers a face, and withdraws it.
    setTable([reader, other])
    expect(pages()[0]).toBe(held)
    setTable([reader])
    expect(pages()[0]).toBe(held)
    // ...and the signal moves for a slot this reading does not hold: a new
    // array of the same registrations.
    setTable([...table()])
    expect(pages()[0]).toBe(held)

    // A NEW REGISTRATION by the same plugin is a new page.
    const again: Hung<FilePageFace> = { plugin: "reader", face: () => null }
    setTable([again])
    expect(pages()[0]).not.toBe(held)
    dispose()
  })
})
