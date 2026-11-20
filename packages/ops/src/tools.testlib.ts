import { NO_KINDS, type OutlineSet, type Reading } from "@olai/format"
import { Effect } from "effect"

import { readingOf, setOf, steady } from "./fixtures.testlib.ts"
import type { Search } from "./ops.ts"
import { asking, type Tool } from "./tools.ts"

export const EVERYTHING = (): OutlineSet =>
  setOf({
    "house.olai": [
      `{"id":"house","ord":"a0","title":"House #home @sam","desc":"the note","date":"2026-08-14","doing":true,"see":["paint"],"after":["paint"]}`,
      `{"id":"paint","parent":"house","ord":"a0","title":"paint the hall","done":"2026-08-09T10:15:00-04:00"}`,
      `{"id":"sand","parent":"house","ord":"a1","title":"sand the floor","todo":true}`,
      `{"id":"grain","parent":"sand","ord":"a0","title":"with the grain"}`,
      `{"id":"in-house","parent":"house","ord":"a2","mirror":"paint"}`,
      `{"id":"loose","ord":"a1","mirror":"paint"}`,
    ].join("\n"),
  }, [
    ["notes/finishes.md", "# Finishes\n\nDoors: matte.\n"],
    [
      "notes/plan.md",
      "---\nagent: claude-opus\nowners: [alice, bob]\n---\n# The plan\n",
    ],
    ["plain.md", "walnut, or birch\n"],
    "saved/page.html",
  ], { "torn.olai": "{ not a record", "torn.md": "{ not a record" })

export const at = (): Reading => readingOf(EVERYTHING())

export const CALLS: Record<string, ReadonlyArray<unknown>> = {
  outlines_index: [{}],
  search_nodes: [
    { text: "hall" },
    { text: "is:open" },
    { text: "" },
    { text: "date:today" },
    { text: `"paint the hall" OR nothing-is-called-this` },
    { text: "House", withDesc: true },
  ],
  outlines_read: [
    { id: "house" },
    { id: "paint" },
    { id: "shed" },
    { id: "house", fields: ["title", "status", "done"] },
  ],
  outlines_subtree: [
    { id: "house", depth: 1 },
    { id: "house" },
    { file: "house.olai" },
    { file: "house.olai", depth: 1 },
    { id: "shed" },
    { id: "house", withDesc: false },
    { id: "house", fields: ["title", "status", "done"] },
    { file: "house.olai", depth: 1, fields: ["title", "status", "custom"] },
  ],
  markdown_index: [{}],
  markdown_read: [{ file: "notes/finishes.md" }, { file: "plain.md" }],
}

export const readsOf = (tools: ReadonlyArray<Tool>) =>
  tools.filter((tool) => tool.kind === "read")

export const uncalled = (tools: ReadonlyArray<Tool>, row: string): ReadonlyArray<string> =>
  readsOf(tools).map((tool) => tool.name).filter((name) => CALLS[`${row}_${name}`] === undefined)

export const escapedIn = (tools: ReadonlyArray<Tool>): ReadonlyArray<string> =>
  tools
    .filter((tool) => tool.description.includes("\\n") || tool.title.includes("\\n"))
    .map((tool) => tool.name)

export const paragraphsIn = (tools: ReadonlyArray<Tool>, name: string): number =>
  (tools.find((tool) => tool.name === name)?.description.match(/\n\n/g) ?? []).length

export const gaveOf = (search: Search, tools: ReadonlyArray<Tool>, row: string) => {
  const door = asking(Effect.sync(() => ({ ...at(), outlineRow: "outline-olai" })), steady().now, NO_KINDS, search)
  const gave = new Map<string, ReadonlyArray<Record<string, unknown>>>()
  for (const tool of readsOf(tools)) {
    if (tool.kind !== "read") continue
    gave.set(
      tool.name,
      (CALLS[`${row}_${tool.name}`] ?? []).map((args) =>
        Effect.runSync(Effect.orDie(tool.ask(door, args as never))) as Record<string, unknown>
      ),
    )
  }
  return (name: string): ReadonlyArray<Record<string, unknown>> => gave.get(name) ?? []
}
