import { expect, test } from "bun:test"

import { spacesSaid } from "./browser/said.ts"
import { SPACES_UNDIALED, type SpacesLink } from "./wire.ts"

const link = (over: Partial<SpacesLink>): SpacesLink => ({
  ...SPACES_UNDIALED,
  since: "2026-09-01T00:00:00Z",
  ...over,
})

test("absent names where olai looked, and is not loud", () => {
  const said = spacesSaid(link({ status: "absent", where: "OLAI_SPACES_URL" }))
  expect(said.label).toBe("no spaces")
  expect(said.detail).toContain("OLAI_SPACES_URL")
  expect(said.loud).toBe(false)
})

test("connected is one quiet word", () => {
  const said = spacesSaid(link({
    status: "connected",
    where: "https://spaces.example",
    told: true,
  }))
  expect(said.label).toBe("spaces")
  expect(said.loud).toBe(false)
})

test("fault is loud and names the refusal", () => {
  const said = spacesSaid(link({
    status: "fault",
    where: "https://spaces.example",
    told: true,
    why: "Authentication failed",
  }))
  expect(said.label).toBe("spaces fault")
  expect(said.detail).toBe("Authentication failed")
  expect(said.loud).toBe(true)
})
