import { NO_PIN } from "@olai/format"
import { expect, test } from "bun:test"

import { parseBool } from "../preference.ts"
import { remembering } from "../preference.testlib.ts"

import { AUTOCOMMIT_KEY, autoCommit, setAutoCommit } from "./autocommit.ts"
import { setPinned } from "./pinned.ts"

test("the key is namespaced to this browser's git preferences", () => {
  expect(AUTOCOMMIT_KEY).toBe("olai.git.autocommit")
})

test("a browser that has never been asked does not auto-commit", () => {
  expect(parseBool(null, false)).toBe(false)
  expect(autoCommit()).toBe(false)
})

test("only the word this app writes is a pick", () => {
  expect(parseBool("true", false)).toBe(true)
  expect(parseBool("false", false)).toBe(false)
  expect(parseBool("1", false)).toBe(false)
  expect(parseBool("yes", false)).toBe(false)
})

test("a pick is remembered under olai.git.autocommit", () => {
  remembering((store) => {
    setAutoCommit(true)
    expect(autoCommit()).toBe(true)
    expect(store.get(AUTOCOMMIT_KEY)).toBe("true")
    setAutoCommit(false)
    expect(autoCommit()).toBe(false)
    expect(store.get(AUTOCOMMIT_KEY)).toBe("false")
  })
})

/**
 * ── what the server pinned ─────────────────────────────────────────────
 *
 * `vault-level-settings`: started with `--commit`, the instance has stated a
 * policy for everybody looking at this directory, so this accessor answers with
 * it and the panel draws the row read-only. The GATE IS ON THE ACCESSOR rather
 * than at each reader, because the loop, the panel's promise line and the row
 * itself all ask this one question — a pin honoured in the drawing but not in
 * the loop would be a frozen control lying about what the browser is doing.
 *
 * `setPinned(NO_PIN)` on the way out of each: the pin is a module-level value
 * (it belongs to the connection, and every surface that draws it reads the one
 * copy), so a case that left one set would pin the next one too.
 */
test("a pinned --commit overrules this browser, both ways", () => {
  remembering(() => {
    try {
      setAutoCommit(false)
      setPinned({ commit: "auto", push: null })
      expect(autoCommit()).toBe(true)

      setAutoCommit(true)
      setPinned({ commit: "manual", push: null })
      expect(autoCommit()).toBe(false)
      // `--commit=off` is a directory olai never commits in, so a browser
      // recording on its own is not a thing that could happen there either.
      setPinned({ commit: "off", push: null })
      expect(autoCommit()).toBe(false)
    } finally {
      setPinned(NO_PIN)
    }
  })
})

/**
 * ... and it does not OVERWRITE what this browser chose.
 *
 * The person's own pick is still in storage exactly as they left it, so a
 * server restarted without the flag hands it straight back rather than leaving
 * everybody on the team's setting for good. That is also why the pin is never
 * stored: it belongs to the running server and is forgotten with the tab.
 */
test("a pin is worn, not written — the browser's own pick comes back", () => {
  remembering((store) => {
    try {
      setAutoCommit(true)
      setPinned({ commit: "manual", push: null })
      expect(autoCommit()).toBe(false)
      expect(store.get(AUTOCOMMIT_KEY)).toBe("true")

      setPinned(NO_PIN)
      expect(autoCommit()).toBe(true)
    } finally {
      setPinned(NO_PIN)
    }
  })
})
