import { NO_SEARCH } from "@olai/ops"
import {
  escapedIn,
  gaveOf,
  paragraphsIn,
  readsOf,
  uncalled,
} from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"
import { Schema } from "effect"

import { tools } from "./tools.ts"

const answers = () => gaveOf(NO_SEARCH, tools, "markdown")

test("every read this row declares is called here", () => {
  expect(uncalled(tools, "markdown")).toEqual([])
})

test("every answer decodes through the shape its own entry declares", () => {
  const of = answers()
  for (const tool of readsOf(tools)) {
    if (tool.kind !== "read") continue
    const decode = Schema.decodeUnknownSync(
      tool.answers as Schema.Codec<unknown, unknown, never, never>,
      { errors: "all", onExcessProperty: "error" },
    )
    for (const answer of of(tool.name)) {
      expect({ [tool.name]: decode(answer) }).toEqual({ [tool.name]: answer })
    }
  }
})

test("the fixture reaches every optional field, so the check is not vacuous", () => {
  const of = answers()

  const documents = of("index")[0]?.["documents"] as ReadonlyArray<
    Record<string, unknown>
  >
  expect(documents).toEqual([
    { file: "notes/finishes.md", title: "Finishes", bytes: 26 },
    {
      file: "notes/plan.md",
      title: "The plan",
      bytes: 59,
      props: { agent: "claude-opus", owners: ["alice", "bob"] },
    },
    { file: "plain.md", title: "walnut, or birch", bytes: 17 },
    { file: "torn.md", unreadable: [expect.any(String)] },
  ])

  expect(of("read")[0]).toEqual({
    file: "notes/finishes.md",
    text: "# Finishes\n\nDoors: matte.\n",
  })
})

test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(paragraphsIn(tools, "index")).toBeGreaterThan(0)
  expect(paragraphsIn(tools, "read")).toBeGreaterThan(0)
})
