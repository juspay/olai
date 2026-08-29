/**
 * The policy the guard applies, tested as the pure function it is —
 * the real-process halves of the same contract are ./shutdown.test.ts's
 * (a stray TERM refused live; the parent path honored live).
 */

import { expect, test } from "bun:test"

import { judge, who } from "./sigterm.ts"

const here = { self: 400, parent: 300 }

test("the supervisor (the parent) is honored — this is how systemctl stop|restart delivers", () => {
  expect(judge({ pid: 300, uid: 1000 }, here)).toBe("honor")
})

test("the kernel is honored: si_pid 0 is the PR_SET_PDEATHSIG contract this process armed itself", () => {
  expect(judge({ pid: 0, uid: 0 }, here)).toBe("honor")
})

test("the process itself is honored: the parent-death race branch kills itself this way", () => {
  expect(judge({ pid: 400, uid: 1000 }, here)).toBe("honor")
})

test("every other pid is refused — the incident's whole class", () => {
  expect(judge({ pid: 987654, uid: 1000 }, here)).toBe("refuse")
  expect(judge({ pid: 301, uid: 1000 }, here)).toBe("refuse")
})

test("uid plays no part in the rule: root is refused like any other stranger", () => {
  expect(judge({ pid: 999, uid: 0 }, here)).toBe("refuse")
  // ...and a root-UID supervisor is honored for being the supervisor
  expect(judge({ pid: 300, uid: 0 }, here)).toBe("honor")
})

test("the supervisor is judged at receipt time: a reparented server honors its NEW parent", () => {
  // Reparented to init after the original parent died: pid 1 is now the
  // supervisor, and the DEAD manager's pid — if recycled by a stranger —
  // must not inherit the old trust.
  expect(judge({ pid: 1, uid: 0 }, { self: 400, parent: 1 })).toBe("honor")
  expect(judge({ pid: 300, uid: 0 }, { self: 400, parent: 1 })).toBe("refuse")
})

test("who() names the kernel and this process without touching /proc", () => {
  expect(who(0, 400)).toBe("the kernel")
  expect(who(400, 400)).toBe("this process")
})

test("who() reads a live sender's cmdline and says when it was already gone", () => {
  if (process.platform !== "linux") return
  expect(who(process.pid, 400)).toContain("bun")
  expect(who(2 ** 22 + 12345, 400)).toContain("already gone")
})
