import { expect, test } from "bun:test"
import { derive } from "@olai/format"
import { TEST_CLAIMS } from "@olai/format/testlib"
import { fileScopes, ringing } from "@olai/plugin-api/file-wakes"

test("file picks hear the whole file and only the nearest node pick hears a nested claim", () => {
  const derived = derive(TEST_CLAIMS, [
    { line: 1, file: "work.olai", node: { id: "root", ord: "a", title: "root" } },
    { line: 1, file: "work.olai", node: { id: "leaf", parent: "root", ord: "a", title: "leaf" } },
  ])
  const rows = fileScopes([
    { agent: "a", session: "whole", pick: "work.olai", current: () => true },
    { agent: "a", session: "root", pick: { file: "work.olai", under: "root" }, current: () => true },
    { agent: "a", session: "leaf", pick: { file: "work.olai", under: "leaf" }, current: () => true },
    { agent: "a", session: "other", pick: "other.olai", current: () => true },
    { agent: "a", session: "cleared", pick: "work.olai", current: () => false },
    { agent: "a", session: "not-file", pick: true, current: () => true },
  ])
  expect(ringing(rows, derived, "work.olai", "leaf").map(row => row.session)).toEqual(["whole", "leaf"])
  expect(ringing(rows, derived, "work.olai", "root").map(row => row.session)).toEqual(["whole", "root"])
})
