import { TEST_CLAIMS } from "@olai/format/testlib"
import { pinTargetIn } from "@olai/format"
import { expect, test } from "bun:test"

import { addressIn as addressWith } from "olai-plugin-navigation/address/address.ts"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"

const addressIn = (title: string) => addressWith(routingIn(), title)

const nodeIn = (title: string): string | undefined => {
  const route = addressIn(title)
  if (route === undefined || route.kind !== "at") return undefined
  const address = route.address
  return address !== null && (address.kind === "node" || address.kind === "row")
    ? address.id
    : undefined
}

const TITLES = [
  "/#herbs",
  "/#a1b2c3",
  "[the herb bed](/#herbs)",
  "[](/#herbs)",
  "/?q=is%3Atodo#herbs",
  "/#the%20bed",
  "  /#herbs  ",
  "/garden.olai#herbs",
  "[the bed](/garden.olai#herbs)",
  "/notes/finishes.md",
  "/notes/finishes.md#install",
  "/garden.olai",
  "/trash",
  "/",
  "/?q=is%3Atodo",
  "the ones I keep coming back to",
  "/etc/passwd",
  "/#",
  "/#%",
  "/%",
  "/%ZZ.md",
  "",
  "see [the trash](/trash) tomorrow",
  "[a b](/#herbs) and more",
  "#herbs",
]

test("where the app's own parser reads a node, the server read the same node", () => {
  for (const title of TITLES) {
    const named = nodeIn(title)
    if (named === undefined) continue
    expect([title, pinTargetIn(TEST_CLAIMS, title)]).toEqual([title, named])
  }
})

test("…and the corpus above actually exercises that direction", () => {
  const named = TITLES.filter((title) => nodeIn(title) !== undefined)
  expect(named.length).toBeGreaterThan(6)
  expect(named.length).toBeLessThan(TITLES.length)
})
