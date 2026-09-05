import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { settingsDocumentIn, settingsFileIn } from "./settings.ts"

const rec = (
  title: string,
  fields: Record<string, string>,
): string =>
  `{"id":${JSON.stringify(title)},"ord":"a0","title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

test("the finder names the shallowest settings.olai", () => {
  expect(settingsFileIn(["notes/Settings.olai", "_olai/Settings.olai", "house.olai"]))
    .toBe("_olai/Settings.olai")
  expect(settingsFileIn(["Settings.olai", "_olai/Settings.olai"])).toBe("Settings.olai")
  expect(settingsFileIn(["house.olai"])).toBeUndefined()
})

test("the overlay is one node per plugin property, properties as strings", () => {
  const nodes = nodesOfFiles({
    "_olai/Settings.olai": [
      rec("kolu", { plugin: "kolu", heartbeat: "10m", "held-for": "0s" }),
      rec("also-kolu", { plugin: "kolu", heartbeat: "1h" }),
      rec("stray", { heartbeat: "1h" }),
    ].join("\n"),
  })
  expect(settingsDocumentIn(nodes, "_olai/Settings.olai")).toEqual({
    kolu: { heartbeat: "10m", "held-for": "0s" },
  })
})

test("an absent file is an empty overlay", () => {
  expect(settingsDocumentIn(nodesOfFiles({ "house.olai": rec("row", {}) }), null)).toEqual({})
})
