import { expect, test } from "bun:test"

import { spacesSaid, spacesStatus } from "./browser/said.ts"
import { SPACES_UNDIALED, type SpacesLink } from "./wire.ts"

const link = (over: Partial<SpacesLink>): SpacesLink => ({
  ...SPACES_UNDIALED,
  since: "2026-09-01T00:00:00Z",
  ...over,
})

test("absent names where olai looked, and is not loud", () => {
  const said = spacesSaid(link({ status: "absent", where: "OLAI_SPACES_URL" }))
  expect(said.label).toBe("No xyne")
  expect(said.detail).toBe("Spaces isn't set up. Looked at OLAI_SPACES_URL. Set OLAI_SPACES_URL and OLAI_SPACES_TOKEN.")
  expect(said.loud).toBe(false)
  expect(said.dot).toBe("bg-muted")
  // Told where to look, it does not repeat the fix.
  expect(spacesSaid(link({ status: "absent", where: "https://spaces.example", told: true })).detail)
    .toBe("Spaces isn't set up. Looked at https://spaces.example.")
})

test("connected is one quiet word", () => {
  const said = spacesSaid(link({
    status: "connected",
    where: "https://spaces.example",
    told: true,
  }))
  expect(said.label).toBe("xyne")
  expect(said.detail).toBe("Posting to https://spaces.example")
  expect(said.loud).toBe(false)
  expect(said.dot).toBe("bg-done")
})

test("fault is loud and names the refusal", () => {
  const said = spacesSaid(link({
    status: "fault",
    where: "https://spaces.example",
    told: true,
    why: "Authentication failed",
  }))
  expect(said.label).toBe("xyne error")
  expect(said.detail).toBe("Authentication failed")
  expect(said.loud).toBe(true)
  expect(said.dot).toBe("bg-alarm")
  // A refusal that gave no reason still names where.
  expect(spacesSaid(link({ status: "fault", where: "https://spaces.example", why: null })).detail)
    .toBe("Spaces refused a post at https://spaces.example.")
})

// ── the readout as the health dot reads it ─────────────────────────────

test("connected is healthy, in the row's own words", () => {
  const up = link({ status: "connected", where: "https://spaces.example", told: true })
  expect(spacesStatus(up)).toEqual({ tone: "healthy", label: "xyne", detail: "Posting to https://spaces.example" })
})

test("a refused post is an alarm", () => {
  const fault = link({ status: "fault", where: "https://spaces.example", told: true, why: "Authentication failed" })
  expect(spacesStatus(fault)).toEqual({ tone: "alarm", label: "xyne error", detail: "Authentication failed" })
})

test("no Spaces app is quiet — including the undialed default the plugin falls back to", () => {
  expect(spacesStatus(link({ status: "absent" }))).toMatchObject({ tone: "quiet", label: "No xyne" })
  expect(spacesStatus(SPACES_UNDIALED).tone).toBe("quiet")
})
