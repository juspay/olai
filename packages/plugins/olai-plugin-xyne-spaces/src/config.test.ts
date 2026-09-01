/**
 * The vault half of the Spaces mirror: `_olai/Spaces.olai`, the finder, the
 * bind, the trim knob.
 */

import { nodesOfFiles } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import {
  boundTo,
  DEFAULT_TRIM,
  spacesConfigIn,
  spacesFileIn,
} from "./config.ts"

const rec = (
  title: string,
  fields: Record<string, string>,
  id = title,
  ord = "a0",
): string =>
  `{"id":${JSON.stringify(id)},"ord":${JSON.stringify(ord)},"title":${JSON.stringify(title)}${
    Object.keys(fields).length === 0 ? "" : `,"custom":${JSON.stringify(fields)}`
  }}`

const setOf = (files: Record<string, string>, file?: string) =>
  spacesConfigIn(
    nodesOfFiles(files),
    file === undefined ? (spacesFileIn(Object.keys(files)) ?? null) : file,
  )

test("the finder names the file by basename and case-folded, shallowest first", () => {
  expect(
    spacesFileIn([
      "notes/spaces.olai",
      "_olai/Spaces.olai",
      "mocca.olai",
    ]),
  ).toBe("_olai/Spaces.olai")
})

test("the finder names nothing a spaces file does not answer to", () => {
  expect(spacesFileIn(["mocca.olai", "_olai/Kolu.olai"])).toBeUndefined()
})

test("a set with no Spaces.olai binds nothing and trims at the default", () => {
  const reading = setOf({
    "_olai/Pins.olai": `{"id":"p","ord":"a0","title":"the shelf"}`,
  })
  expect(reading.bind).toBeNull()
  expect(reading.trim).toBe(DEFAULT_TRIM)
  expect(reading.malformed).toEqual([])
})

test("a mirror node with a channel binds that channel", () => {
  const reading = setOf({
    "_olai/Spaces.olai": rec("mirror", {
      channel: "ch-team-olai",
      agent: "claude",
      session: "s-1",
    }),
  })
  expect(reading.bind).toEqual({
    channel: "ch-team-olai",
    agent: "claude",
    session: "s-1",
  })
})

test("a mirror without agent or session binds every conversation on that channel", () => {
  const reading = setOf({
    "_olai/Spaces.olai": rec("mirror", { channel: "ch-team-olai" }),
  })
  expect(reading.bind).toEqual({
    channel: "ch-team-olai",
    agent: null,
    session: null,
  })
  expect(boundTo(reading.bind, "claude", "s-1")).toBe(true)
  expect(boundTo(reading.bind, "opencode", "other")).toBe(true)
})

test("an agent-only bind matches that agent's sessions and no other agent's", () => {
  const bind = { channel: "ch", agent: "claude", session: null }
  expect(boundTo(bind, "claude", "s-1")).toBe(true)
  expect(boundTo(bind, "claude", "s-2")).toBe(true)
  expect(boundTo(bind, "opencode", "s-1")).toBe(false)
})

test("no bind matches nothing", () => {
  expect(boundTo(null, "claude", "s-1")).toBe(false)
})

test("a digest trim is a positive integer, and a bad one defaults and is said", () => {
  const ok = setOf({
    "_olai/Spaces.olai": [
      rec("mirror", { channel: "ch" }),
      rec("digest", { trim: "240" }, "digest", "a1"),
    ].join("\n"),
  })
  expect(ok.trim).toBe(240)
  expect(ok.malformed).toEqual([])

  const bad = setOf({
    "_olai/Spaces.olai": rec("digest", { trim: "plenty" }),
  })
  expect(bad.trim).toBe(DEFAULT_TRIM)
  expect(bad.malformed.length).toBe(1)
  expect(bad.malformed[0]).toContain("trim: plenty")
})
