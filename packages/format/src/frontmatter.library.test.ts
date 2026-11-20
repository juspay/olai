import { expect, test } from "bun:test"
import { parse } from "yaml"

import type { CustomValue } from "./custom.ts"
import { frontmatterIn } from "./frontmatter.ts"

const block = (line: string): string => `---\n${line}\n---\n`

const library = (line: string): unknown => {
  try {
    return parse(block(line).slice(4, -5))
  } catch {
    return null
  }
}

const agrees = (line: string, value: CustomValue): void => {
  expect(frontmatterIn(block(line))).toEqual({ key: value } as never)
  expect(library(line)).toEqual({ key: value } as never)
}

const refuses = (line: string): void => {
  expect(frontmatterIn(block(line))).toEqual({})
  expect(library(line)).toBeNull()
}

const narrower = (line: string): void => {
  expect(frontmatterIn(block(line))).toEqual({})
  expect(library(line)).not.toBeNull()
}

test("a scalar is the text somebody typed, to both readings", () => {
  agrees("key: a plain value", "a plain value")
  agrees('key: "quoted"', "quoted")
  agrees("key: 'quoted'", "quoted")
  agrees("key: x # a comment", "x")
  agrees("key: kitchen#2", "kitchen#2")
})

test("a list is a list to both readings", () => {
  agrees("key: [a, b]", ["a", "b"])
  agrees("key: ['#home', '#kitchen']", ["#home", "#kitchen"])
  agrees("key: [kitchen#2, x]", ["kitchen#2", "x"])
  agrees("key:\n  - a\n  - b", ["a", "b"])
  agrees("key:\n- a\n- b", ["a", "b"])
})

test("a # in a flow sequence is refused by both readings", () => {
  refuses("key: [#home, #kitchen]")
  refuses("key: [#home]")
  refuses("key: [a, #b]")
  refuses("key: [a #b, c]")
  refuses("key: [a, b #c]")
})

test("a key the library reads as null is a key we do not carry", () => {
  expect(frontmatterIn(block("key: #176"))).toEqual({})
  expect(library("key: #176")).toEqual({ key: null } as never)
  expect(frontmatterIn(block("key:"))).toEqual({})
  expect(library("key:")).toEqual({ key: null } as never)
})

test("what the library reads and this reading declines, in full", () => {
  narrower("key: [a, b] # note")
  narrower("key: { a: 1 }")
  narrower("key: [[a], b]")
  narrower("key: |\n  a block scalar")
  narrower("key: >\n  a folded scalar")
  narrower("key:\n  nested: map")
  narrower("key: &anchor x")
  narrower("key: !!str 5")
})

test("a number and a boolean are the text somebody typed", () => {
  expect(frontmatterIn(block("key: 2"))).toEqual({ key: "2" } as never)
  expect(library("key: 2")).toEqual({ key: 2 } as never)
  expect(frontmatterIn(block("key: true"))).toEqual({ key: "true" } as never)
  expect(library("key: true")).toEqual({ key: true } as never)
})
