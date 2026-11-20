import { expect, test } from "bun:test"

import { meaningOf, type MeaningVault, NO_KINDS, NO_TYPING } from "@olai/format"

import { type Door, doorFor } from "./door.ts"
import type { Names } from "../names.ts"
import { atFile } from "olai-plugin-navigation/routes"
import { routingIn } from "olai-plugin-navigation/routes.testlib.ts"

const { href: hrefOf, routeIn } = routingIn()

const SERVED = ["briefs/pda.md", "brainstorming/props-ui.html", "orchestrator/agents.olai"]

const DOCUMENTS = ["briefs/pda.md"]
const DECLARED: Record<string, { id: string; title: string; file: string }> = {
  pi: { id: "pi", title: "pi", file: "orchestrator/agents.olai" },
}

const vault: MeaningVault = {
  declarations: NO_TYPING,
  kinds: NO_KINDS,
  declares: (id) => DECLARED[id] !== undefined,
  serves: (file) => SERVED.includes(file),
  documents: (file) => DOCUMENTS.includes(file),
}

const names: Names = (id) => DECLARED[id]

const doorFrom = (from: string) => (value: string, key = "note"): Door | null => {
  const opens = meaningOf(vault, from, key, value)
  return opens === null ? null : doorFor(opens, value, names, meaning => meaning.kind === "document" ? atFile(meaning.file) : meaning.kind === "day" ? routeIn(`/d/${meaning.date}`) ?? undefined : undefined)
}

const LANES = doorFrom("orchestrator/lanes.olai")
const ROOT = doorFrom("roadmap.olai")

test("a URL leaves the app", () => {
  expect(ROOT("https://github.com/juspay/olai/pull/369"))
    .toEqual({
      kind: "away",
      href: "https://github.com/juspay/olai/pull/369",
      says: "https://github.com/juspay/olai/pull/369",
      face: "https://github.com/juspay/olai/pull/369",
    })
})

test("a date has no door when the journal route is not registered", () => {
  expect(ROOT("2026-08-31")).toBeNull()
  expect(ROOT("2026-08-24 16:20")).toBeNull()
})

const opens = (door: Door | null): string | undefined =>
  door === null ? undefined : door.kind === "away" ? door.href : hrefOf(door.route)

test("a value that IS a node's id opens that node, and says what it is called", () => {
  const door = LANES("pi")
  expect(door?.kind).toBe("node")
  expect(opens(door)).toBe("/#pi")
  expect(door?.says).toBe("pi")
  expect(door?.face).toBe("pi")
})

test("a vault path opens that document — resolved beside the file it was written in", () => {
  const door = ROOT("briefs/pda.md")
  expect(door?.kind).toBe("document")
  expect(opens(door)).toBe("/briefs/pda.md")
  expect(door?.says).toBe("briefs/pda.md")
  expect(LANES("briefs/pda.md")).toBeNull()
  expect(LANES("../briefs/pda.md")?.kind).toBe("document")
})

test("...and a `.html` beside them, because a saved page has a page too", () => {
  expect(ROOT("brainstorming/props-ui.html")?.kind).toBe("document")
})

test("`owner/repo#123` opens that issue or pull request", () => {
  expect(ROOT("juspay/olai#369"))
    .toEqual({
      kind: "away",
      href: "https://github.com/juspay/olai/issues/369",
      says: "https://github.com/juspay/olai/issues/369",
      face: "juspay/olai#369",
    })
})

test("prose stays prose, however much of it there is", () => {
  expect(ROOT("the human approves personally")).toBeNull()
  expect(ROOT("")).toBeNull()
})

test("a value with a URL IN it is not a URL — the board's own `pr` values", () => {
  expect(ROOT("#365 https://github.com/juspay/olai/pull/365 @ efc32b13 — reported 12:45"))
    .toBeNull()
})

test("an id-shaped value the set does not declare stays text", () => {
  expect(LANES("claude-opus")).toBeNull()
  expect(LANES("stranger")).toBeNull()
})

test("a node is matched by ID and never by title", () => {
  const titled = (value: string): Door | null => {
    const opens = meaningOf(
      { ...vault, declares: (id) => id === "agent-pi" },
      "roadmap.olai",
      "note",
      value,
    )
    return opens === null ? null : doorFor(opens, value, (id) =>
      id === "agent-pi"
        ? { id: "agent-pi", title: "pi", file: "orchestrator/agents.olai" }
        : undefined)
  }
  expect(titled("pi")).toBeNull()
  expect(titled("agent-pi")?.kind).toBe("node")
})

test("a bare `#123` names nothing, because which repository is nowhere on this screen", () => {
  expect(ROOT("#369")).toBeNull()
  expect(ROOT("369")).toBeNull()
  expect(ROOT("olai#369")).toBeNull()
})

test("a path the directory does not serve is a string, not a broken link", () => {
  expect(ROOT("briefs/nothing.md")).toBeNull()
})

test("a relative path to something with no page is left alone", () => {
  expect(ROOT("orchestrator/agents.olai")?.kind).toBe("document")
  expect(ROOT("notes/scratch.txt")).toBeNull()
})

test("a scheme that is not http is not a door", () => {
  expect(ROOT("mailto:someone@example.com")).toBeNull()
  expect(ROOT("file:///etc/passwd")).toBeNull()
})

test("`javascript:` and `data:` are text, and cannot become an href", () => {
  for (const value of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "data:text/plain;base64,YWJj",
    "javascript:alert(1)#x",
    "vbscript:msgbox(1)",
  ]) {
    expect(ROOT(value)).toBeNull()
  }
})

test("a date-shaped value is a date even where a node id could have matched", () => {
  const dated = meaningOf(
    { ...vault, declares: (id) => id === "2026-08-31" },
    "roadmap.olai",
    "note",
    "2026-08-31",
  )
  expect(dated?.kind).toBe("day")
})

test("a shape that is not a calendar day is not a date", () => {
  expect(ROOT("2026-02-30")).toBeNull()
  expect(ROOT("2026-8-31")).toBeNull()
})

test("an answer the vault declared a reference draws the target's title", () => {
  const door = doorFor({ kind: "node", id: "pi", titled: true }, "pi", names)
  expect(door.face).toBe("pi")
  expect(door.says).toBe("pi")
  const claude = doorFor(
    { kind: "node", id: "agent-claude-opus", titled: true },
    "agent-claude-opus",
    (id) =>
      id === "agent-claude-opus"
        ? { id, title: "claude-opus", file: "orchestrator/agents.olai" }
        : undefined,
  )
  expect(claude.face).toBe("claude-opus")
  expect(claude.says).toBe("agent-claude-opus")
  expect(opens(claude)).toBe("/#agent-claude-opus")
})

test("...and falls back to the id when the page's names table has no entry", () => {
  const door = doorFor({ kind: "node", id: "gone", titled: true }, "gone", () => undefined)
  expect(door.face).toBe("gone")
})

test("an absent destination capability leaves the property as text", () => {
  expect(doorFor({ kind: "document", file: "briefs/pda.md" }, "briefs/pda.md", names, () => undefined)).toBeNull()
  expect(doorFor({ kind: "day", date: "2026-09-05" }, "2026-09-05", names, () => undefined)).toBeNull()
})
