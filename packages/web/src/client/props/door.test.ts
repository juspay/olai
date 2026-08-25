/**
 * WHAT A PROPERTY VALUE OPENS — the whole of `./door.ts`'s rule, and in
 * particular the values it refuses.
 *
 * The refusals are half the cases here on purpose. A door that opens is easy to
 * see on a screen; a door drawn where none should be is a link that silently
 * goes to the wrong place, and "a wrong door is worse than no door" is only a
 * rule if something fails when it is broken.
 */

import { expect, test } from "bun:test"

import { doorFor, type Vault } from "./door.ts"
import { hrefOf } from "../routes.ts"
import type { Named } from "@olai/format"

/** The directory these cases are read against: two documents, one node the set
 *  declares, and a file the vault does NOT serve. */
const SERVED = ["briefs/pda.md", "brainstorming/props-ui.html", "orchestrator/agents.olai"]
const DECLARED: Record<string, Named> = {
  pi: { id: "pi", title: "pi", file: "orchestrator/agents.olai" },
}

const vault = (from: string): Vault => ({
  from,
  serves: (file) => SERVED.includes(file),
  names: (id) => DECLARED[id],
})

/** Written on a record of `orchestrator/lanes.olai`, which is where the live
 *  board's lane nodes are — so a value naming `briefs/pda.md` is naming it from
 *  one directory in. */
const LANES = vault("orchestrator/lanes.olai")
const ROOT = vault("roadmap.olai")

// ── the five kinds ─────────────────────────────────────────────────────

test("a URL leaves the app", () => {
  expect(doorFor("https://github.com/juspay/olai/pull/369", ROOT))
    .toEqual({
      kind: "away",
      href: "https://github.com/juspay/olai/pull/369",
      says: "https://github.com/juspay/olai/pull/369",
    })
})

test("a date opens that day, and a datetime opens the day it is on", () => {
  expect(doorFor("2026-08-31", ROOT))
    .toEqual({ kind: "day", route: { kind: "day", date: "2026-08-31" }, says: "what is on 2026-08-31" })
  expect(doorFor("2026-08-24 16:20", ROOT))
    .toEqual({ kind: "day", route: { kind: "day", date: "2026-08-24" }, says: "what is on 2026-08-24" })
})

/** Where a door in this app GOES, as the URL a click follows — the route's own
 *  printing (`../routes.ts`), because an address is a branded value and a
 *  literal beside it in a test would be a second spelling of the grammar. */
const opens = (door: ReturnType<typeof doorFor>): string | undefined =>
  door === null ? undefined : door.kind === "away" ? door.href : hrefOf(door.route)

test("a value that IS a node's id opens that node, and says what it is called", () => {
  const door = doorFor("pi", LANES)
  expect(door?.kind).toBe("node")
  expect(opens(door)).toBe("/#pi")
  expect(door?.says).toBe("pi")
})

test("a vault path opens that document — resolved beside the file it was written in", () => {
  // From `orchestrator/lanes.olai`, a bare `briefs/pda.md` is
  // `orchestrator/briefs/pda.md`, which the directory does not serve; the same
  // value written on a root outline names the served file. That is the same
  // arithmetic a relative link in a note takes, and the reason it is asked at
  // all is that a property value states nothing — a path the directory has not
  // got is a string that turned out not to be a path.
  const door = doorFor("briefs/pda.md", ROOT)
  expect(door?.kind).toBe("document")
  expect(opens(door)).toBe("/briefs/pda.md")
  expect(door?.says).toBe("briefs/pda.md")
  expect(doorFor("briefs/pda.md", LANES)).toBeNull()
  expect(doorFor("../briefs/pda.md", LANES)?.kind).toBe("document")
})

test("...and a `.html` beside them, because a saved page has a page too", () => {
  expect(doorFor("brainstorming/props-ui.html", ROOT)?.kind).toBe("document")
})

test("`owner/repo#123` opens that issue or pull request", () => {
  expect(doorFor("juspay/olai#369", ROOT))
    .toEqual({
      kind: "away",
      href: "https://github.com/juspay/olai/issues/369",
      says: "juspay/olai#369 on GitHub",
    })
})

// ── and everything the rule refuses ────────────────────────────────────

test("prose stays prose, however much of it there is", () => {
  expect(doorFor("the human approves personally", ROOT)).toBeNull()
  expect(doorFor("", ROOT)).toBeNull()
})

test("a value with a URL IN it is not a URL — the board's own `pr` values", () => {
  expect(
    doorFor(
      "#365 https://github.com/juspay/olai/pull/365 @ efc32b13 — reported 12:45",
      ROOT,
    ),
  ).toBeNull()
})

test("an id-shaped value the set does not declare stays text", () => {
  expect(doorFor("claude-opus", LANES)).toBeNull()
  expect(doorFor("stranger", LANES)).toBeNull()
})

test("a node is matched by ID and never by title", () => {
  // The declared node's title is `pi` as well, so this case has to name one
  // that is not: a value equal to some node's TITLE and to no node's id opens
  // nothing.
  const titled: Vault = {
    ...ROOT,
    names: (id) => (id === "agent-pi"
      ? { id: "agent-pi", title: "pi", file: "orchestrator/agents.olai" }
      : undefined),
  }
  expect(doorFor("pi", titled)).toBeNull()
  expect(doorFor("agent-pi", titled)?.kind).toBe("node")
})

test("a bare `#123` names nothing, because which repository is nowhere on this screen", () => {
  expect(doorFor("#369", ROOT)).toBeNull()
  expect(doorFor("369", ROOT)).toBeNull()
  expect(doorFor("olai#369", ROOT)).toBeNull()
})

test("a path the directory does not serve is a string, not a broken link", () => {
  expect(doorFor("briefs/nothing.md", ROOT)).toBeNull()
})

test("a relative path to something with no page is left alone", () => {
  // `.olai` is served and has a page; a `.txt` beside the notes has neither.
  expect(doorFor("orchestrator/agents.olai", ROOT)?.kind).toBe("document")
  expect(doorFor("notes/scratch.txt", ROOT)).toBeNull()
})

test("a scheme that is not http is not a door", () => {
  expect(doorFor("mailto:someone@example.com", ROOT)).toBeNull()
  expect(doorFor("file:///etc/passwd", ROOT)).toBeNull()
})

/**
 * THE TWO SCHEMES THAT WOULD BE A HOLE, named rather than left to follow from
 * the ones above.
 *
 * `isHttp` is a whole-value `http(s)://` prefix and `pathedOf` refuses anything
 * carrying a scheme, so neither of these was ever reachable — but "a value
 * cannot become a `javascript:` href" is a security claim about this module,
 * and a claim nothing asserts is a claim the next edit can quietly drop
 * (grok, NIT 3). Cased both bare and dressed as something else.
 */
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
    expect(doorFor(value, ROOT)).toBeNull()
  }
})

test("a date-shaped value is a date even where a node id could have matched", () => {
  const dated: Vault = {
    ...ROOT,
    names: (id) => (id === "2026-08-31"
      ? { id: "2026-08-31", title: "a node called after a day", file: "x.olai" }
      : undefined),
  }
  expect(doorFor("2026-08-31", dated)?.kind).toBe("day")
})

test("a shape that is not a calendar day is not a date", () => {
  // `2026-02-30` passes the shape and is not a day — the format's own rule,
  // asked here rather than answered a second time.
  expect(doorFor("2026-02-30", ROOT)).toBeNull()
  expect(doorFor("2026-8-31", ROOT)).toBeNull()
})
