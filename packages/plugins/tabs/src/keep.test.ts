import { expect, test } from "bun:test"
import { createRoot } from "solid-js"
import type { Attention, AttentionRow } from "olai-plugin-chat/attention"
import { atFile, atNode } from "olai-plugin-navigation/routes"
import { hrefOfWorkspace } from "olai-plugin-navigation/workspace"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"
import { keptChats } from "./keep.ts"

const routes = routingIn()
const rows: ReadonlyArray<AttentionRow> = [
  { id: "one", file: "house.olai", standing: "idle" },
  { id: "two", file: "yard.olai", standing: "asleep" },
]
const reading = (hrefs: string[], unfolded: string[], roster = rows) => createRoot(dispose => {
  const chat: Attention = {
    agents: { rows: () => roster, at: id => roster.find(row => row.id === id) },
    folding: { unfolded: id => unfolded.includes(id) },
    keep: () => () => {},
  }
  const result = [...keptChats(chat, routes, {
    tabs: () => hrefs.map((href, i) => ({ id: String(i), href, title: href })),
    front: () => "0", drawn: () => true,
  })()]
  dispose()
  return result
})

test("all panes and tabs contribute, including sleeping rows for chat to filter", () => {
  const split = hrefOfWorkspace(routes, { focus: 0, layout: { kind: "split", axis: "row", children: [
    { layout: { kind: "leaf", route: atFile("house.olai") } },
    { layout: { kind: "leaf", route: atFile("yard.olai") } },
  ] } })
  expect(reading([split], ["one", "two"])).toEqual(["one", "two"])
})

test("folded conversations are excluded but their own node pages are included", () => {
  expect(reading([routes.href(atFile("house.olai"))], [])).toEqual([])
  expect(reading([routes.href(atNode("one"))], [])).toEqual(["one"])
})

test("no roster or no tabs holds nothing; repeated tabs hold each node once", () => {
  expect(reading(["/house.olai"], ["one"], [])).toEqual([])
  expect(reading([], ["one"])).toEqual([])
  expect(reading(["/house.olai", "/house.olai", routes.href(atNode("one"))], ["one"])).toEqual(["one"])
})
