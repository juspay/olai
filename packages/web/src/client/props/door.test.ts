/**
 * WHAT A PROPERTY VALUE OPENS — the whole seam, end to end, and in particular
 * the values it refuses.
 *
 * The refusals are half the cases here on purpose. A door that opens is easy to
 * see on a screen; a door drawn where none should be is a link that silently
 * goes to the wrong place, and "a wrong door is worse than no door" is only a
 * rule if something fails when it is broken.
 *
 * ## Why these cases survived a change that moved the rule out of this package
 *
 * The question moved (`@olai/format`'s `meaning.ts` holds it now, where the set
 * is); the ANSWERS did not, for every key nobody declared. So this file asks
 * the whole seam — consult, then {@link doorFor} — over the corpus it always
 * asked, and every expectation below is the one it carried before the move.
 * That is the differential: a guess that used to be right is still right, one
 * layer down, and a case that changes here is a regression rather than a
 * rewrite.
 *
 * The DECLARED arm — where the answers deliberately differ, because the vault
 * now says something — is the format module's own suite
 * (`@olai/format`'s `meaning.test.ts`). What this file adds beside the corpus
 * is the half that is genuinely the browser's: the route a door opens, and the
 * face it wears.
 */

import { expect, test } from "bun:test"

import { meaningOf, type MeaningVault, NO_KINDS, NO_TYPING } from "@olai/format"

import { type Door, doorFor } from "./door.ts"
import type { Names } from "../names.ts"
import { hrefOf } from "../routes.ts"

/** The directory these cases are read against: two documents, one node the set
 *  declares, and a file the vault does NOT serve. */
const SERVED = ["briefs/pda.md", "brainstorming/props-ui.html", "orchestrator/agents.olai"]

/** ...and the `.md` half of it, WRITTEN OUT rather than filtered by suffix: a
 *  fixture that decided what a document is by spelling `.endsWith` would be a
 *  second answer to the one place that says what a file of the set is
 *  (`@olai/format`'s `kinds.ts`, and the sweep in `@olai/tests` that hunts for
 *  exactly that). */
const DOCUMENTS = ["briefs/pda.md"]
const DECLARED: Record<string, { id: string; title: string; file: string }> = {
  pi: { id: "pi", title: "pi", file: "orchestrator/agents.olai" },
}

/** The vault the CONSULT is asked of — three facts about a directory that
 *  declares no property key at all, which is the arm this file is about. */
const vault: MeaningVault = {
  declarations: NO_TYPING,
  kinds: NO_KINDS,
  declares: (id) => DECLARED[id] !== undefined,
  serves: (file) => SERVED.includes(file),
  // The narrow question a `doc` gets, and no case here asks it: this file is
  // about the arm a vault that declares NOTHING takes, which asks the wide one
  // (`@olai/format`'s `meaning.ts` argues the split, and its own suite is where
  // the two are held against each other).
  documents: (file) => DOCUMENTS.includes(file),
}

/** ...and the names table the browser joins a node answer against — the same
 *  one entry, because a page resolves every door's target into it. */
const names: Names = (id) => DECLARED[id]

/**
 * THE WHOLE SEAM, as one call: what a value written in `from` opens.
 *
 * `key` defaults to a word this vault declares nothing about, which is what
 * every case below is asking about — the shape guesses, unchanged.
 */
const doorFrom = (from: string) => (value: string, key = "note"): Door | null => {
  const opens = meaningOf(vault, from, key, value)
  return opens === null ? null : doorFor(opens, value, names)
}

/** Written on a record of `orchestrator/lanes.olai`, which is where the live
 *  board's lane nodes are — so a value naming `briefs/pda.md` is naming it from
 *  one directory in. */
const LANES = doorFrom("orchestrator/lanes.olai")
const ROOT = doorFrom("roadmap.olai")

// ── the five kinds ─────────────────────────────────────────────────────

test("a URL leaves the app", () => {
  expect(ROOT("https://github.com/juspay/olai/pull/369"))
    .toEqual({
      kind: "away",
      href: "https://github.com/juspay/olai/pull/369",
      says: "https://github.com/juspay/olai/pull/369",
      face: "https://github.com/juspay/olai/pull/369",
    })
})

test("a date opens that day, and a datetime opens the day it is on", () => {
  expect(ROOT("2026-08-31"))
    .toEqual({
      kind: "day",
      route: { kind: "day", date: "2026-08-31" },
      says: "what is on 2026-08-31",
      face: "2026-08-31",
    })
  // THE FACE KEEPS THE MINUTE while the door opens the day — the words on a
  // chip are the record's words, and only a declared reference changes that
  // (`./door.ts`).
  expect(ROOT("2026-08-24 16:20"))
    .toEqual({
      kind: "day",
      route: { kind: "day", date: "2026-08-24" },
      says: "what is on 2026-08-24",
      face: "2026-08-24 16:20",
    })
})

/** Where a door in this app GOES, as the URL a click follows — the route's own
 *  printing (`../routes.ts`), because an address is a branded value and a
 *  literal beside it in a test would be a second spelling of the grammar. */
const opens = (door: Door | null): string | undefined =>
  door === null ? undefined : door.kind === "away" ? door.href : hrefOf(door.route)

test("a value that IS a node's id opens that node, and says what it is called", () => {
  const door = LANES("pi")
  expect(door?.kind).toBe("node")
  expect(opens(door)).toBe("/#pi")
  expect(door?.says).toBe("pi")
  // ...and DRAWS THE VALUE, because nobody declared this key a reference: the
  // string the record holds is the fact somebody wrote.
  expect(door?.face).toBe("pi")
})

test("a vault path opens that document — resolved beside the file it was written in", () => {
  // From `orchestrator/lanes.olai`, a bare `briefs/pda.md` is
  // `orchestrator/briefs/pda.md`, which the directory does not serve; the same
  // value written on a root outline names the served file. That is the same
  // arithmetic a relative link in a note takes, and the reason it is asked at
  // all is that a property value states nothing — a path the directory has not
  // got is a string that turned out not to be a path.
  //
  // It is also the exact divergence a DECLARED key now settles: the board
  // writes this value from the root and means it, which is what `base: root`
  // is for (`@olai/format`'s `meaning.test.ts`). Undeclared, it stays a guess.
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
  // The FACE is what was written and the tooltip is where the click goes,
  // which is the one door whose two halves are spelled differently.
  expect(ROOT("juspay/olai#369"))
    .toEqual({
      kind: "away",
      href: "https://github.com/juspay/olai/issues/369",
      says: "https://github.com/juspay/olai/issues/369",
      face: "juspay/olai#369",
    })
})

// ── and everything the rule refuses ────────────────────────────────────

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
  // The declared node's title is `pi` as well, so this case has to name one
  // that is not: a value equal to some node's TITLE and to no node's id opens
  // nothing.
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
  // `.olai` is served and has a page; a `.txt` beside the notes has neither.
  expect(ROOT("orchestrator/agents.olai")?.kind).toBe("document")
  expect(ROOT("notes/scratch.txt")).toBeNull()
})

test("a scheme that is not http is not a door", () => {
  expect(ROOT("mailto:someone@example.com")).toBeNull()
  expect(ROOT("file:///etc/passwd")).toBeNull()
})

/**
 * THE TWO SCHEMES THAT WOULD BE A HOLE, named rather than left to follow from
 * the ones above.
 *
 * `isHttp` is a whole-value `http(s)://` prefix and `pathedOf` refuses anything
 * carrying a scheme, so neither of these was ever reachable — but "a value
 * cannot become a `javascript:` href" is a security claim about this seam, and
 * a claim nothing asserts is a claim the next edit can quietly drop (grok,
 * NIT 3). Cased both bare and dressed as something else.
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
  // `2026-02-30` passes the shape and is not a day — the format's own rule,
  // asked here rather than answered a second time.
  expect(ROOT("2026-02-30")).toBeNull()
  expect(ROOT("2026-8-31")).toBeNull()
})

// ── what the browser adds: the face a declaration licenses ─────────────

/**
 * A REF CHIP DRAWS THE TITLE, and the id is what the pointer is told.
 *
 * The other half of `ref-chip-face-shows-id`: the door existed and carried the
 * resolved title, but the title landed only in the hover tooltip while the face
 * drew the stored value verbatim — so every lane chip read `agent
 * agent-claude-opus`. This is the answer arriving `titled` and the face
 * spending it.
 */
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
  // Which the projection makes unreachable (`@olai/format`'s `pageOf` resolves
  // every door's target INTO the names table). Asserted anyway, because the
  // honest dead link is what every reader of that table means by absence, and
  // an empty face would be a chip that says nothing at all.
  const door = doorFor({ kind: "node", id: "gone", titled: true }, "gone", () => undefined)
  expect(door.face).toBe("gone")
})
