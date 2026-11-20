import { expect, test } from "bun:test"

import { judge, SI, who } from "./sigterm.ts"

const here = { self: 400, parent: 300, armedParent: 300 }

test("the supervisor (the parent) is honored — this is how systemctl stop|restart delivers", () => {
  expect(judge({ pid: 300, uid: 1000, code: SI.USER }, here)).toBe("honor")
  expect(judge({ pid: 300, uid: 1000, code: SI.TKILL }, here)).toBe("honor")
})

test("the process itself is honored: the parent-death race branch kills itself this way", () => {
  expect(judge({ pid: 400, uid: 1000, code: SI.USER }, here)).toBe("honor")
})

test("pid 0 is the belt, accepted only with a genuine kernel tag", () => {
  expect(judge({ pid: 0, uid: 0, code: SI.KERNEL }, here)).toBe("honor")
})

test("THE MEASURED PDEATH SHAPE: the dying parent's pid, SI_USER, read after reparenting — honored", () => {
  const reparented = { self: 400, parent: 1, armedParent: 300 }
  expect(judge({ pid: 300, uid: 1000, code: SI.USER }, reparented)).toBe("honor")
  expect(judge({ pid: 1, uid: 0, code: SI.USER }, reparented)).toBe("honor")
  expect(judge({ pid: 301, uid: 1000, code: SI.USER }, reparented)).toBe("refuse")
})

test("the armed-parent arm is vacuous while that parent is alive", () => {
  expect(judge({ pid: 300, uid: 1000, code: SI.USER }, here)).toBe("honor")
})

test("every other pid is refused — the incident's whole class", () => {
  expect(judge({ pid: 987654, uid: 1000, code: SI.USER }, here)).toBe("refuse")
  expect(judge({ pid: 301, uid: 1000, code: SI.TKILL }, here)).toBe("refuse")
})

test("uid plays no part in the rule: root is refused like any other stranger", () => {
  expect(judge({ pid: 999, uid: 0, code: SI.USER }, here)).toBe("refuse")
  expect(judge({ pid: 300, uid: 0, code: SI.USER }, here)).toBe("honor")
})

test("the forge gate: a user-SUPPLIED siginfo can claim to be the supervisor — its si_code gives it away", () => {
  const reparented = { self: 400, parent: 1, armedParent: 300 }
  expect(judge({ pid: 1, uid: 0, code: -1 }, reparented)).toBe("refuse")
  expect(judge({ pid: 300, uid: 1000, code: -1 }, reparented)).toBe("refuse")
  expect(judge({ pid: 400, uid: 1000, code: -1 }, here)).toBe("refuse")
  expect(judge({ pid: 0, uid: 0, code: -1 }, here)).toBe("refuse")
})

test("a reparented server honors its CURRENT parent — never a stale one", () => {
  expect(judge({ pid: 1, uid: 0, code: SI.USER }, { self: 400, parent: 1, armedParent: 1 })).toBe("honor")
  expect(judge({ pid: 300, uid: 0, code: SI.USER }, { self: 400, parent: 1, armedParent: 1 })).toBe("refuse")
})

test("who() names the kernel and this process without touching /proc", () => {
  expect(who(0, 400)).toBe("(the kernel)")
  expect(who(400, 400)).toBe("(this process)")
})

test("who() reads a live sender's cmdline and says when it was already gone", () => {
  if (process.platform !== "linux") return
  expect(who(process.pid, 400)).toContain("bun")
  expect(who(2 ** 22 + 12345, 400)).toContain("already gone")
})
