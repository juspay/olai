/**
 * WHAT AN AGENT ACTUALLY READS, over the two file verbs this row declares — because
 * the way this breaks is per-description and silent.
 *
 * `markdown_index` and `markdown_read` shipped to review with `\\n\\n` in their
 * descriptions: two characters, a backslash and an `n`, where every other entry
 * has a real paragraph break. Nothing catches that. It compiles, the prose
 * assertions elsewhere still pass (they look for words, not shape), and the only
 * reader who ever sees it is the model reading `tools/list`. The ban is the
 * harness's ({@link escapedIn}) and every row runs it over its own table, since
 * `@olai/ops`' one closed list — which is where a single test used to say this
 * for all twenty-eight — went out to the rows (juspay/olai#546).
 *
 * This row has no READ, so there is no answer shape to walk: the decode tests
 * live in the rows that do (`olai-plugin-outlines`, `olai-plugin-markdown`,
 * `olai-plugin-search`).
 */

import { escapedIn } from "@olai/ops/testlib/tools"
import { expect, test } from "bun:test"

import { tools } from "./tools.ts"

test("no tool describes itself with an escaped newline", () => {
  expect(escapedIn(tools)).toEqual([])
  // …and the table is really the one this row declares, so the ban above is not
  // a claim about an empty list.
  expect(tools.map((tool) => tool.name)).toContain("delete")
})
