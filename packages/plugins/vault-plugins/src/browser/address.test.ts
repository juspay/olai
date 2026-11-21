/**
 * `/plugins/<word>` AND EVERYTHING UNDER IT, as the grammar reads an address.
 *
 * Three pages share the prefix, and which one an address opens is the whole of
 * what is asked here: the plugin's approval page, that page opened at one of
 * the folder's files, and the plugin's OWN page under `app`, which only the
 * plugin draws. The approval page must stay reachable at the bare word whatever
 * a plugin registers, and a path that names a file the folder could hold must
 * keep opening that file there, even when it sits under `app/`.
 *
 * The grammar is `./address.ts`, a module with no JSX, so `bun test` at the
 * root can import it; `./route.ts` joins it to the page's glyph.
 */
import { expect, test } from "bun:test"

import { parsePluginPage, pluginPageHref } from "./address.ts"

test("the bare word is the approval page, and a held file opens it at that file", () => {
  expect(parsePluginPage("/plugins/reader")).toEqual({ word: "reader" })
  expect(parsePluginPage("/plugins/reader/server.ts")).toEqual({ word: "reader", file: "server.ts" })
  expect(parsePluginPage("/plugins/reader/lib/sm2.ts")).toEqual({ word: "reader", file: "lib/sm2.ts" })
  expect(parsePluginPage("/plugins/reader/README.md")).toEqual({ word: "reader", file: "README.md" })
})

test("`app` and everything under it is the plugin's own page, handed the rest of the path", () => {
  expect(parsePluginPage("/plugins/reader/app")).toEqual({ word: "reader", app: "" })
  expect(parsePluginPage("/plugins/reader/app/review")).toEqual({ word: "reader", app: "review" })
  expect(parsePluginPage("/plugins/reader/app/chapter/2")).toEqual({ word: "reader", app: "chapter/2" })
})

test("a code file under `app/` is still a file of the folder, opened on the approval page", () => {
  expect(parsePluginPage("/plugins/reader/app/review.ts")).toEqual({ word: "reader", file: "app/review.ts" })
})

test("anything else under the word is no page", () => {
  expect(parsePluginPage("/plugins/reader/notes.txt")).toBeNull()
  expect(parsePluginPage("/plugins/reader/application")).toBeNull()
  expect(parsePluginPage("/plugins/Not A Word/app")).toBeNull()
})

test("every page under the word prints the address it was read from", () => {
  for (const address of ["/plugins/reader", "/plugins/reader/lib/sm2.ts", "/plugins/reader/app", "/plugins/reader/app/review", "/plugins/reader/app/chapter/2"]) {
    const value = parsePluginPage(address)
    expect(value).not.toBeNull()
    expect(pluginPageHref(value!)).toBe(address)
  }
})
