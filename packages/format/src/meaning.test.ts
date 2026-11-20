import { TEST_CLAIMS } from "@olai/format/testlib"
import { expect, test } from "bun:test"

import { addressOf } from "./address.ts"
import { readingOfVault } from "./scope.testlib.ts"
import { consult, Door, Licence, type Meaning, meaningOf, type Vault } from "./meaning.ts"
import { pageOf } from "./page.ts"
import { nodeNamed } from "./derive.ts"
import {
  BOOTSTRAP,
  type ContributedKind,
  declarationsOf,
  NO_KINDS,
  type Typed,
  wrongValue,
} from "./typing.ts"
import { markdownPaths } from "./rules.ts"
import type { Reading } from "./validate.ts"

const VAULT = new Map<string, string>([
  ["_olai/Properties.olai", [
    `{"id":"prop-brief","ord":"a0","title":"brief","custom":{"type":"doc","base":"root"}}`,
    `{"id":"prop-note","ord":"a1","title":"note","custom":{"type":"doc"}}`,
    `{"id":"prop-agent","ord":"a2","title":"agent","custom":{"type":"ref","under":"agents"}}`,
    `{"id":"prop-merge","ord":"a3","title":"merge","custom":{"type":"ref"}}`,
    `{"id":"merge-auto","parent":"prop-merge","ord":"a0","title":"automatic"}`,
    `{"id":"merge-human","parent":"prop-merge","ord":"a1","title":"the human merges"}`,
    `{"id":"prop-worktree","ord":"a4","title":"worktree","custom":{"type":"path"}}`,
    `{"id":"prop-records","ord":"a5","title":"records","custom":{"type":"int"}}`,
    `{"id":"prop-dispatched","ord":"a6","title":"dispatched","custom":{"type":"date"}}`,
    `{"id":"prop-pr-url","ord":"a7","title":"pr-url","custom":{"type":"text"}}`,
    `{"id":"prop-item","ord":"a8","title":"item","custom":{"type":"node"}}`,
  ].join("\n")],
  ["agents.olai", [
    `{"id":"agents","ord":"a0","title":"the agents"}`,
    `{"id":"grok","parent":"agents","ord":"a0","title":"Grok"}`,
  ].join("\n")],
  ["roadmap/lanes.olai", [
    `{"id":"lanes","ord":"a0","title":"the lanes"}`,
    `{"id":"lane","parent":"lanes","ord":"a0","title":"one lane","custom":{` +
      `"brief":"briefs/tp.md","note":"briefs/tp.md","agent":"grok","merge":"merge-auto",` +
      `"worktree":".worktrees/tp","records":"193","dispatched":"2026-08-25",` +
      `"pr-url":"https://github.com/juspay/olai/pull/402","item":"agents"}}`,
  ].join("\n")],
  ["board.olai", [
    `{"id":"board","ord":"a0","title":"the board"}`,
    `{"id":"root-lane","parent":"board","ord":"a0","title":"a lane at the root",` +
      `"custom":{"brief":"briefs/tp.md","note":"briefs/tp.md"}}`,
  ].join("\n")],
  ["briefs/tp.md", "# the brief\n"],
])

const READ: Reading = readingOfVault(VAULT)

const vault: Vault = {
  declarations: declarationsOf(READ.derived, NO_KINDS),
  declares: (id) => nodeNamed(READ.derived, id) !== undefined,
  serves: (file) => READ.set.documents.some((face) => face.path === file),
  documents: (file) => markdownPaths(READ.set).has(file),
  kinds: NO_KINDS,
}

const typed: Typed = {
  declarations: vault.declarations,
  derived: READ.derived,
  documents: markdownPaths(READ.set),
  kinds: NO_KINDS,
}

const IN_SUB = "roadmap/lanes.olai"
const AT_ROOT = "board.olai"

const lanes = () =>
  pageOf(READ, {
    kind: "at",
    address: addressOf(TEST_CLAIMS, IN_SUB, null)!,
  })

test("a `doc` key declared `base: root` resolves from the served root, wherever it is written", () => {
  expect(meaningOf(vault, IN_SUB, "brief", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
  expect(meaningOf(vault, AT_ROOT, "brief", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
})

test("...and a key that declares no base keeps resolving beside the writing file", () => {
  expect(meaningOf(vault, IN_SUB, "note", "briefs/tp.md")).toBeNull()
  expect(meaningOf(vault, AT_ROOT, "note", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
  expect(meaningOf(vault, IN_SUB, "note", "../briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
})

test("what the gate accepts is what the display opens, over every `doc` value", () => {
  for (const from of [IN_SUB, AT_ROOT]) {
    for (const key of ["brief", "note"]) {
      for (const value of DOC_CORPUS) {
        const refused = wrongValue(typed, from, key, value) !== undefined
        const opens = meaningOf(vault, from, key, value)
        expect([from, key, value, refused]).toEqual([from, key, value, opens === null])
      }
    }
  }
})

const DOC_CORPUS = [
  "briefs/tp.md",
  "../briefs/tp.md",
  "briefs/missing.md",
  "not a path",
  "https://example.com/x.md",
  "",
  "agents.olai",
  "../agents.olai",
  "/briefs/tp.md",
  "briefs/t%70.md",
] as const

test("a `ref` value opens its target, and the face is told to draw the title", () => {
  expect(meaningOf(vault, IN_SUB, "agent", "grok"))
    .toEqual({ kind: "node", id: "grok", titled: true })
  expect(meaningOf(vault, IN_SUB, "merge", "merge-auto"))
    .toEqual({ kind: "node", id: "merge-auto", titled: true })
  expect(meaningOf(vault, IN_SUB, "item", "agents"))
    .toEqual({ kind: "node", id: "agents", titled: true })
})

test("...where a value that merely turned out to be an id is NOT titled", () => {
  expect(meaningOf(vault, IN_SUB, "sighted", "grok"))
    .toEqual({ kind: "node", id: "grok", titled: false })
})

test("a `path` opens only what the directory actually serves — `worktree` is not a door", () => {
  expect(meaningOf(vault, IN_SUB, "worktree", ".worktrees/tp")).toBeNull()
  expect(meaningOf(vault, AT_ROOT, "worktree", "briefs/tp.md"))
    .toEqual({ kind: "document", file: "briefs/tp.md" })
})

test("a declared `int` names nothing, however id-shaped it looks", () => {
  expect(meaningOf(vault, IN_SUB, "records", "193")).toBeNull()
  expect(meaningOf(vault, IN_SUB, "records", "agents")).toBeNull()
  expect(meaningOf(vault, IN_SUB, "sighted", "agents")?.kind).toBe("node")
})

test("a declared `date` opens its day, and refuses everything that is not one", () => {
  expect(meaningOf(vault, IN_SUB, "dispatched", "2026-08-25"))
    .toEqual({ kind: "day", date: "2026-08-25" })
  expect(meaningOf(vault, IN_SUB, "dispatched", "grok")).toBeNull()
})

test("the three arms that part from the gate on purpose, and why each may", () => {
  const parts = (key: string, value: string, opens: Meaning): void => {
    expect([key, value, wrongValue(typed, IN_SUB, key, value) !== undefined])
      .toEqual([key, value, true])
    expect([key, value, meaningOf(vault, IN_SUB, key, value)]).toEqual([key, value, opens])
  }
  parts("dispatched", "2026-08-25 10:06", { kind: "day", date: "2026-08-25" })
  parts("dispatched", "2026-08-25T10:06:00Z", { kind: "day", date: "2026-08-25" })
  parts("agent", "merge-auto", { kind: "node", id: "merge-auto", titled: true })
})

test("a declared `text` reads exactly as an undeclared key does — which is why `pr-url` still opens", () => {
  const url = "https://github.com/juspay/olai/pull/402"
  expect(meaningOf(vault, IN_SUB, "pr-url", url)).toEqual({ kind: "away", href: url })
  expect(meaningOf(vault, IN_SUB, "undeclared", url)).toEqual({ kind: "away", href: url })
  expect(meaningOf(vault, IN_SUB, "pr-url", "#402 merged at 12:45")).toBeNull()
})

test("a `ref` value naming nothing this set declares stays text", () => {
  expect(meaningOf(vault, IN_SUB, "agent", "nobody")).toBeNull()
})

test("the page ships a door per value that names something, and nothing that names nothing", () => {
  const page = lanes()
  const doors = new Map(page.doors.map((one) => [`${one.prop}=${one.value}`, one.opens]))
  expect(doors.get("brief=briefs/tp.md")).toEqual({ kind: "document", file: "briefs/tp.md" })
  expect(doors.get("agent=grok")).toEqual({ kind: "node", id: "grok", titled: true })
  expect(doors.get("merge=merge-auto")).toEqual({ kind: "node", id: "merge-auto", titled: true })
  expect(doors.get("dispatched=2026-08-25")).toEqual({ kind: "day", date: "2026-08-25" })
  expect(doors.has("worktree=.worktrees/tp")).toBe(false)
  expect(doors.has("records=193")).toBe(false)
  expect(doors.has("note=briefs/tp.md")).toBe(false)
  expect(page.doors.every((one) => one.from === IN_SUB)).toBe(true)
})

test("a door onto a node is named in the same page's names table — the titled face's other half", () => {
  const page = lanes()
  const named = new Map(page.names.map((one) => [one.id, one.title]))
  for (const door of page.doors) {
    if (door.opens.kind !== "node") continue
    expect([door.value, named.get(door.opens.id)])
      .toEqual([door.value, named.get(door.opens.id) ?? "MISSING"])
    expect(named.has(door.opens.id)).toBe(true)
  }
  expect(named.get("grok")).toBe("Grok")
  expect(named.get("merge-auto")).toBe("automatic")
})

test("no declaration shape rides the page — the tab receives answers, not the vocabulary", () => {
  const page = lanes()
  const carried = fieldsIn([...page.doors, ...page.licences])
  expect([...carried].sort()).toEqual([
    "date",
    "file",
    "from",
    "href",
    "id",
    "kind",
    "opens",
    "prop",
    "titled",
    "value",
  ])
  expect([...Object.keys(Door.fields)].sort()).toEqual(["from", "opens", "prop", "value"])
  for (const word of BOOTSTRAP.keys()) {
    expect([word, carried.has(word)]).toEqual([word, false])
  }
  expect(page.doors.length).toBeGreaterThan(0)
})

test("the page ships a LICENCE per claimed value, and the vault it was read from stays off the wire", () => {
  const read = readingOfVault(
    new Map<string, string>([
      ["_olai/Properties.olai", [
        `{"id":"p","ord":"a0","title":"pty","custom":{"type":"sprocket"}}`,
        `{"id":"q","ord":"a1","title":"brief","custom":{"type":"text"}}`,
      ].join("\n")],
      ["a.olai", [
        `{"id":"top","ord":"a0","title":"the rows"}`,
        `{"id":"one","parent":"top","ord":"a0","title":"one",` +
          `"custom":{"pty":"c56b6183","brief":"notes.md","sprocket":"deadbeef"}}`,
      ].join("\n")],
    ]),
  )
  const at = { kind: "at", address: addressOf(TEST_CLAIMS, "a.olai", null)! } as const
  const running = { built: new Map([["sprocket", SPROCKET]]), enabled: new Map([["sprocket", SPROCKET]]) }
  const page = pageOf(read, at, running)
  expect(page.licences).toEqual([
    { from: "a.olai", prop: "pty", value: "c56b6183", word: "sprocket" },
  ])
  expect(page.licences.map((one) => one.prop)).not.toContain("sprocket")
  expect(pageOf(read, at, { built: running.built, enabled: new Map() }).licences).toEqual([])
  expect([...fieldsIn(page.licences)].sort()).toEqual(["from", "prop", "value", "word"])
  expect([...Object.keys(Licence.fields)].sort()).toEqual(["from", "prop", "value", "word"])
})

test("a contributed kind draws no door of the app's own, and reads as text where nobody answers for it", () => {
  const read = readingOfVault(
    new Map<string, string>([
      ["_olai/Properties.olai", `{"id":"p","ord":"a0","title":"pty","custom":{"type":"sprocket"}}`],
      ["a.olai", `{"id":"one","ord":"a0","title":"one","custom":{"pty":"https://example.com/x"}}`],
    ]),
  )
  const asking = (enabled: boolean): Vault => ({
    declarations: declarationsOf(read.derived, NO_KINDS),
    declares: () => false,
    serves: () => false,
    documents: () => false,
    kinds: {
      built: new Map([["sprocket", SPROCKET]]),
      enabled: enabled ? new Map([["sprocket", SPROCKET]]) : new Map(),
    },
  })
  expect(meaningOf(asking(true), "a.olai", "pty", "https://example.com/x")).toBeNull()
  expect(meaningOf(asking(false), "a.olai", "pty", "https://example.com/x"))
    .toEqual({ kind: "away", href: "https://example.com/x" })
})

test("...and the WORD is the consult's other answer, on the key the vault actually declared", () => {
  const read = readingOfVault(
    new Map<string, string>([
      ["_olai/Properties.olai", `{"id":"p","ord":"a0","title":"pty","custom":{"type":"sprocket"}}`],
      ["a.olai", `{"id":"one","ord":"a0","title":"one","custom":{"pty":"c56b6183"}}`],
    ]),
  )
  const asking = (enabled: boolean): Vault => ({
    declarations: declarationsOf(read.derived, NO_KINDS),
    declares: () => false,
    serves: () => false,
    documents: () => false,
    kinds: {
      built: new Map([["sprocket", SPROCKET]]),
      enabled: enabled ? new Map([["sprocket", SPROCKET]]) : new Map(),
    },
  })
  expect(consult(asking(true), "a.olai", "pty", "c56b6183"))
    .toEqual({ opens: null, word: "sprocket" })
  expect(consult(asking(false), "a.olai", "pty", "c56b6183"))
    .toEqual({ opens: null, word: null })
  expect(consult(asking(true), "a.olai", "sprocket", "c56b6183"))
    .toEqual({ opens: null, word: null })
  expect(consult(asking(true), "a.olai", "pty", "a note about it"))
    .toEqual({ opens: null, word: null })
  expect(consult(asking(true), "a.olai", "undeclared", "2026-08-30"))
    .toEqual({ opens: { kind: "day", date: "2026-08-30" }, word: null })
})

const SPROCKET: ContributedKind = {
  kind: "sprocket",
  takes: "`sprocket` (a sprocket id)",
  admits: (value) => /^[0-9a-f-]+$/.test(value),
}

const fieldsIn = (value: unknown): Set<string> => {
  const names = new Set<string>()
  const walk = (one: unknown): void => {
    if (Array.isArray(one)) {
      for (const member of one) walk(member)
      return
    }
    if (one === null || typeof one !== "object") return
    for (const [name, held] of Object.entries(one)) {
      names.add(name)
      walk(held)
    }
  }
  walk(value)
  return names
}
