import { expect, test } from "bun:test"

import { DEFAULT_POLICY, NO_PIN, type GitState } from "@olai/format"
import { keyings } from "@olai/surface/testlib"

import { surface } from "./wire.ts"

const GIT_OFF_REPO: GitState = {
  status: "repo",
  said: null,
  pinned: NO_PIN,
  policy: DEFAULT_POLICY,
  pushSaid: null,
  paused: null,
}

test("what git is doing knows when it has not changed", () => {
  const healthy: GitState = GIT_OFF_REPO
  expect(surface.spec.cells.git.equals?.(healthy, { ...GIT_OFF_REPO })).toBe(true)
  expect(
    surface.spec.cells.git.equals?.(healthy, { ...healthy, status: "error" }),
  ).toBe(false)
  expect(
    surface.spec.cells.git.equals?.(
      { ...healthy, status: "error", said: "no user.email" },
      { ...healthy, status: "error", said: "gpg failed" },
    ),
  ).toBe(false)
  for (
    const moved of [
      { pinned: { commit: "auto", push: null } },
      { policy: { commit: "auto", push: "off" } },
      { pushSaid: "! [rejected] main -> main" },
      { paused: "! [rejected] main -> main" },
    ] as const
  ) {
    expect(surface.spec.cells.git.equals?.(healthy, { ...healthy, ...moved })).toBe(false)
  }
})

test("the three verbs sit on this spec, not on core's", () => {
  expect(Object.keys(surface.spec.procedures?.git ?? {}).sort()).toEqual([
    "commit",
    "push",
    "resume",
  ])
})

test("the pending cell is keyed by the one name its two row lists share", () => {
  expect(surface.spec.cells.pending.arrayKey).toBe("path")
  const schema = surface.spec.cells.pending.schema as unknown as {
    readonly ast: Parameters<typeof keyings>[0]["ast"]
  }
  const found = keyings(schema, "path")
  expect(found.get("outlines")).toBe("keyed")
  expect(found.get("others")).toBe("keyed")
  expect(found.get("changes")).toBe("positional")
  expect(found.get("wrote")).toBe("positional")
  expect(keyings(schema, "file").get("changes")).toBe("keyed")
})
