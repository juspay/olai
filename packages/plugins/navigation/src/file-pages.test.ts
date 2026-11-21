/**
 * A WHOLE FILE, DRAWN BY THE PLUGIN WHOSE KIND IT IS — `file.page` read into the
 * pages a file address is dispatched over (`./PageView.tsx`).
 *
 * A plugin that claims a suffix (`FileKinds`, on its server file) has its kind
 * stamped with its own name, and its `file.page` face is that kind's page. What
 * is asked here is the choice: a file of the plugin's kind is drawn by its face
 * and not by the general drawing for what such a file holds, and a file of any
 * other kind never is.
 */
import { DocumentPath } from "@olai/format"
import type { Hung } from "@olai/plugin-api"
import { forFileClaim } from "@olai/plugin-api/file-kinds"
import { expect, test } from "bun:test"

import type { FilePage } from "./index.ts"
import { filePagesOf } from "./file-pages.ts"
import type { FilePageFace } from "./slots.ts"

const face: FilePageFace = () => null
const hung = (plugin: string): Hung<FilePageFace> => ({ plugin, face })

/** The general drawing for a file that holds text — what a `.csv` without its
 *  own page, or any text kind nobody draws, would get. */
const general: FilePage = { by: { holds: "text" }, edits: true, page: () => null }

test("a file of the plugin's own kind is drawn by its face, over the general drawing for text", () => {
  const drawn: Array<readonly [FilePageFace, string]> = []
  const pages = filePagesOf([hung("reader")], (one, file) => { drawn.push([one, file]); return null })
  const chosen = forFileClaim({ kind: "reader", holds: "text" }, [general, ...pages])
  expect(chosen?.by).toEqual({ kind: "reader" })
  // A plugin's face draws; it does not open the editor a text page offers.
  expect(chosen?.edits).toBe(false)
  chosen!.page({ kind: "document", path: DocumentPath.make("chapter-1.reader") })
  expect(drawn).toEqual([[face, "chapter-1.reader"]])
})

test("a file of another kind is never drawn by it", () => {
  const pages = filePagesOf([hung("reader")], () => null)
  expect(forFileClaim({ kind: "notes", holds: "text" }, [general, ...pages])).toBe(general)
  expect(forFileClaim({ kind: "csv", holds: "text" }, pages)).toBeUndefined()
})

test("with the plugin gone, its kind's files fall back to nothing of its own", () => {
  expect(filePagesOf([], () => null)).toEqual([])
})
