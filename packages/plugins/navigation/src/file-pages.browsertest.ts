/**
 * A PLUGIN-DRAWN FILE PAGE IS SETTLED WHERE ITS FACES ARE HELD, AND KEEPS ITS
 * IDENTITY while the slot table moves for any other reason.
 *
 * The `file.page` faces are read through navigation's `renderer` component,
 * which holds the faces and settles the pages in its own root, as it settles
 * `app.route`; `./PageView.tsx` reads the tracked holder in `./pages.ts`. So
 * the pages exist exactly while that component stands, whatever order its
 * holds are taken in.
 *
 * And one page per registration: `./PageView.tsx` draws the chosen page
 * through a keyed `<Show>`, so a page minted afresh per reading would be the
 * open file drawn again from nothing each time some other plugin hung a chip.
 *
 * Under the browser condition because the subjects are memos and a tracked
 * holder, and a server-resolved Solid never recomputes one.
 */
import { expect, test } from "bun:test"
import type { Hung } from "@olai/plugin-api"
import { createMemo, createRoot, createSignal } from "solid-js"

import { filePagesOver } from "./file-pages.ts"
import { holdPluginFilePages, pluginFilePages } from "./pages.ts"
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

test("the pages are read through the holder: empty unheld, there once held, empty once released, with no other signal moving", () => {
  createRoot((dispose) => {
    const reader: Hung<FilePageFace> = { plugin: "reader", face: () => null }
    const seen = createMemo(() => pluginFilePages().map((page) => page.by))
    expect(seen()).toEqual([])
    const release = holdPluginFilePages(filePagesOver(() => [reader], () => null))
    expect(seen()).toEqual([{ kind: "reader" }])
    release()
    expect(seen()).toEqual([])
    dispose()
  })
})
