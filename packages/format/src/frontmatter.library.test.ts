/**
 * THE VALUE SUBSET, held against the REAL PARSER — so "a stated subset" is a
 * checked claim rather than a sentence in a header.
 *
 * `./frontmatter.ts` reads a sliver of YAML on purpose: a property is text or a
 * list of text (`./custom.ts`'s `CustomValue`), and that is the whole of what
 * this format has anywhere to put. The module says so at length. What it could
 * not say, until this file, is that the sliver is the SAME sliver the ecosystem
 * reads — and the one place that matters is a `.md` in somebody's vault, which
 * GitHub renders, an editor colours, and a static site builds from.
 *
 * So every case below is asked TWICE, and there are exactly two ways to pass:
 *
 *   - {@link agrees} — the library reads a value a property can hold, and we
 *     read the same thing. This is the sliver.
 *   - {@link refuses} — the library REFUSES the input outright (it throws), and
 *     so do we, by leaving the key off. Refusing together is agreeing.
 *
 * A third outcome exists and is named rather than hidden: {@link narrower},
 * where the library reads something and we decline to. Each of those is a
 * refusal this module's header argues for by name, and writing them here is
 * what keeps the list of them honest — a case that quietly moved out of
 * `agrees` and into `narrower` would be a subset that shrank without anybody
 * ruling it.
 *
 * `yaml` is a DEVDEPENDENCY and nothing ships it: it is imported here and
 * nowhere else in the package, exactly as `remark-frontmatter` is a
 * devDependency of `@olai/web` for the boundary fence next door
 * (`markdown/frontmatter.test.ts`). Putting it in the module instead was
 * measured and refused — the header has the number.
 */

import { expect, test } from "bun:test"
import { parse } from "yaml"

import type { CustomValue } from "./custom.ts"
import { frontmatterIn } from "./frontmatter.ts"

/** The one line under test, as the block a document would carry. */
const block = (line: string): string => `---\n${line}\n---\n`

/** What the LIBRARY makes of it — or `null` for input it refuses outright.
 *  A throw is an answer here, and the one `refuses` is about. */
const library = (line: string): unknown => {
  try {
    return parse(block(line).slice(4, -5))
  } catch {
    return null
  }
}

/** WE READ IT, AND SO DOES THE LIBRARY, and the value is the same. */
const agrees = (line: string, value: CustomValue): void => {
  expect(frontmatterIn(block(line))).toEqual({ key: value } as never)
  expect(library(line)).toEqual({ key: value } as never)
}

/** NEITHER OF US READS IT: the library throws, and the key is one this
 *  document does not carry. */
const refuses = (line: string): void => {
  expect(frontmatterIn(block(line))).toEqual({})
  expect(library(line)).toBeNull()
}

/** THE LIBRARY READS IT AND WE DECLINE TO — every one of these is a refusal
 *  `./frontmatter.ts`'s header argues by name, listed so the subset cannot
 *  narrow without somebody noticing. */
const narrower = (line: string): void => {
  expect(frontmatterIn(block(line))).toEqual({})
  expect(library(line)).not.toBeNull()
}

test("a scalar is the text somebody typed, to both readings", () => {
  agrees("key: a plain value", "a plain value")
  agrees('key: "quoted"', "quoted")
  agrees("key: 'quoted'", "quoted")
  agrees("key: x # a comment", "x")
  // A `#` with no whitespace in front of it is part of the word.
  agrees("key: kitchen#2", "kitchen#2")
})

test("a list is a list to both readings", () => {
  agrees("key: [a, b]", ["a", "b"])
  agrees("key: ['#home', '#kitchen']", ["#home", "#kitchen"])
  agrees("key: [kitchen#2, x]", ["kitchen#2", "x"])
  agrees("key:\n  - a\n  - b", ["a", "b"])
  agrees("key:\n- a\n- b", ["a", "b"])
})

/**
 * THE `#` IN A FLOW SEQUENCE, which is the case the review asked about and the
 * reason this file exists.
 *
 * `[#home, #kitchen]` looks like a list of two tags and is not one to anybody:
 * a plain scalar may not OPEN with a `#`, so the library refuses the whole
 * document. `[a #b, c]` is the other shape — a comment in a flow context runs
 * to the end of the line and eats the closing bracket, so the library refuses
 * that too. We refuse both, which is what makes them a stated sentence rather
 * than an accident of which function read the member.
 */
test("a # in a flow sequence is refused by both readings", () => {
  refuses("key: [#home, #kitchen]")
  refuses("key: [#home]")
  refuses("key: [a, #b]")
  refuses("key: [a #b, c]")
  refuses("key: [a, b #c]")
})

// A value the library reads as `null`, and a key holding nothing is a key this
// document does not carry (`./write.ts`'s `nothing`) — so the two answers are
// the same answer under two spellings.
test("a key the library reads as null is a key we do not carry", () => {
  expect(frontmatterIn(block("key: #176"))).toEqual({})
  expect(library("key: #176")).toEqual({ key: null } as never)
  expect(frontmatterIn(block("key:"))).toEqual({})
  expect(library("key:")).toEqual({ key: null } as never)
})

/**
 * WHERE WE ARE NARROWER, in full — every one of these is read by the library
 * and refused here, and every one has a sentence in `./frontmatter.ts`'s
 * header saying why. `CustomValue` is text or a list of text: there is nowhere
 * to put a map, a nested list, or a number that is not the text somebody typed.
 */
test("what the library reads and this reading declines, in full", () => {
  // A trailing comment after a bracketed value — refused because taking one
  // off the inside of a flow context correctly is having a parser.
  narrower("key: [a, b] # note")
  // Shapes a property has nowhere to hold.
  narrower("key: { a: 1 }")
  narrower("key: [[a], b]")
  narrower("key: |\n  a block scalar")
  narrower("key: >\n  a folded scalar")
  narrower("key:\n  nested: map")
  // Anchors and explicit tags: YAML constructs whose meaning is elsewhere in
  // the document.
  narrower("key: &anchor x")
  narrower("key: !!str 5")
})

// A number and a boolean are TEXT here and typed values there, which is
// `./custom.ts`'s standing ruling rather than a gap: a value that wants to be a
// number can be one the day a reading needs it. Written out because it is the
// one place the two readings differ on a value they BOTH read.
test("a number and a boolean are the text somebody typed", () => {
  expect(frontmatterIn(block("key: 2"))).toEqual({ key: "2" } as never)
  expect(library("key: 2")).toEqual({ key: 2 } as never)
  expect(frontmatterIn(block("key: true"))).toEqual({ key: "true" } as never)
  expect(library("key: true")).toEqual({ key: true } as never)
})
