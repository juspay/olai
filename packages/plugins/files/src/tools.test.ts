import { escapedIn } from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"

import { tools } from "./tools.ts"

test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  expect(tools.map((tool) => tool.name)).toContain("delete")
})
