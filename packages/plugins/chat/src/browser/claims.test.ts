import { expect, test } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"

import { LOOK } from "./agents/roster.ts"

const BROWSER = import.meta.dirname
const SELF = import.meta.filename

const codeOf = (file: string): string =>
  fs
    .readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "")

const SOURCES: ReadonlyArray<{ file: string; code: string }> = fs
  .readdirSync(BROWSER, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name))
  .filter((full) => full !== SELF)
  .map((full) => ({ file: path.relative(BROWSER, full), code: codeOf(full) }))

const filesSpelling = (pattern: RegExp): ReadonlyArray<string> =>
  SOURCES
    .filter((one) => pattern.test(one.code))
    .map((one) => one.file)
    .sort()

test("a tool call's status is spelled where it is meant and where it is drawn", () => {
  const statuses = /["'`](pending|in_progress)["'`]/
  expect(filesSpelling(statuses)).toEqual([
    "chat/Plan.tsx",
    path.join("chat", "background.test.ts"),
    path.join("chat", "door.test.ts"),
    path.join("chat", "elapsed.test.ts"),
    path.join("chat", "lanes.test.ts"),
    path.join("chat", "order.test.ts"),
    path.join("chat", "rail.test.ts"),
    path.join("chat", "rows.testlib.ts"),
    path.join("chat", "spawn.test.ts"),
  ])
})

test("the open preview is put away for a reason of the panel's, never as a dismissal", () => {
  expect(filesSpelling(/closePreview\s*\(\s*\)/)).toEqual([
    path.join("chat", "Preview.tsx"),
    path.join("chat", "previewing.test.ts"),
    path.join("chat", "state.ts"),
  ])
})

test("nothing in the panel reads the readout's raw states", () => {
  const states = /["'`](connecting|live|degraded|reconnecting|retired)["'`]/
  expect(filesSpelling(states)).toEqual([])
})

test("every dynamic import() this tree spells takes a literal the bundler can read", () => {
  const ARG_GEN = /^(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')\s*\)/
  const offenders = SOURCES.filter((one) =>
    [...one.code.matchAll(/\bimport\s*\(\s*/g)].some(
      (hit) => !ARG_GEN.test(one.code.slice(hit.index + hit[0].length)),
    ),
  ).map((one) => one.file)
  expect(offenders).toEqual([])
  expect(filesSpelling(/\bimport\s*\(/)).toEqual([
    path.join("agents", "ChatRowMenu.tsx"),
    path.join("agents", "FreshStart.tsx"),
    path.join("agents", "NewChat.tsx"),
    path.join("agents", "Standing.tsx"),
  ])
})

test("the stack is joined directly only where the gestures are not dismissOn's", () => {
  expect(filesSpelling(/topmostWhileOpen/)).toEqual([
    path.join("agents", "ChatRowPanel.tsx"),
    path.join("agents", "EngineMenu.tsx"),
    path.join("chat", "CompletionMenu.tsx"),
  ])
})

test("only a refused write draws the error report's rows in this tree", () => {
  expect(filesSpelling(/from\s*"[^"]*Report\.tsx"/)).toEqual([
    path.join("chat", "Refusal.tsx"),
  ])
})

test("the live cue's classes are typed in exactly one file", () => {
  expect(filesSpelling(/animate-pulse[^"]*rounded-full[^"]*bg-doing/)).toEqual([
    path.join("chat", "live.ts"),
  ])
})

test("no standing is told apart from another by its pulse alone", () => {
  const standings = Object.keys(LOOK) as ReadonlyArray<keyof typeof LOOK>
  const still = (dot: string) => dot.split(" ").filter(one => !one.startsWith("animate-")).join(" ")
  expect(new Set(standings.map(one => still(LOOK[one].dot))).size)
    .toEqual(new Set(standings.map(one => LOOK[one].dot)).size)
})
