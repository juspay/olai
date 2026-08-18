/**
 * A file's own line endings, which the editor must not quietly change.
 *
 * The failure this is written against was found by review rather than by use,
 * and it is the quietest kind: open a `.md` written on Windows, type one
 * character, and the autosave sends a file whose every OTHER line ending has
 * become an `\n` — a diff nobody made, in a PR nobody meant, from a keystroke
 * that was about one word.
 */

import { expect, test } from "bun:test"

import { separatorOf } from "./separator.ts"

test("a file written in CRLF says so", () => {
  expect(separatorOf("a\r\nb")).toBe("\r\n")
  expect(separatorOf("# Title\r\n\r\nA paragraph.\r\n")).toBe("\r\n")
})

test("a file written in LF names nothing — which is CodeMirror's own default", () => {
  expect(separatorOf("a\nb")).toBeUndefined()
  expect(separatorOf("")).toBeUndefined()
  expect(separatorOf("one line, no break at all")).toBeUndefined()
})

test("a MIXED file names nothing, and that is the careful answer", () => {
  // Naming `\r\n` here would be worse than the default: the state would split
  // on that alone, and the bare `\n` would stop being a break and become a
  // character sitting inside a line.
  expect(separatorOf("a\r\nb\nc")).toBeUndefined()
  expect(separatorOf("a\nb\r\nc")).toBeUndefined()
})

test("a lone carriage return is not a line ending this names", () => {
  // Old-Mac `\r` breaks are split by CodeMirror's own pattern and are not a
  // separator any file this app serves is written with; the default answer is
  // the honest one rather than a third case nobody can test against a real
  // vault.
  expect(separatorOf("a\rb")).toBeUndefined()
})
