import { expect, test } from "bun:test"
import { Schema, SchemaAST } from "effect"
import { readingOfVault } from "@olai/format/testlib/scope"
import { Config, processPolicy } from "./process-policy.ts"

test("serve policy has one described default and reads the olai namespace", () => {
  expect(Schema.decodeUnknownSync(Config)({})).toEqual({ "log-level": "info", "log-format": "auto" })
  expect(Config.ast._tag).toBe("Objects")
  if (Config.ast._tag === "Objects") for (const field of Config.ast.propertySignatures) expect(SchemaAST.resolveDescription(field.type)).toBeTruthy()
  const read = (level: string) => ({ revision: 1, rows: new Map(), file: "_olai/Settings.olai",
    nodes: readingOfVault(new Map([["_olai/Settings.olai", JSON.stringify({ id: "process", ord: "a0", title: "olai", custom: { "log-level": level } })]])).derived.nodes })
  expect(processPolicy(read("debug"), () => {}).values.find(one => one.key === "log-level")).toMatchObject({ key: "log-level", value: "debug", setBy: "vault" })
  const warnings: string[] = []
  expect(processPolicy(read("loud"), line => warnings.push(line)).config["log-level"]).toBe("info")
  expect(warnings[0]).toContain("olai.log-level")
})
