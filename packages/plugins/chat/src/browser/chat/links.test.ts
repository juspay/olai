import { describe, expect, test } from "bun:test"

import { linkify } from "./links.ts"

describe("links out of a login's output", () => {
  test("a URL on its own line is the whole line", () => {
    // The shape `claude auth login` prints: the sentence, then the URL.
    expect(linkify("https://claude.ai/oauth?code=abc")).toEqual([
      { text: "https://claude.ai/oauth?code=abc", href: "https://claude.ai/oauth?code=abc" },
    ])
  })

  test("the prose around it stays prose", () => {
    expect(linkify("Visit https://example.com/device and enter the code:")).toEqual([
      { text: "Visit ", href: null },
      { text: "https://example.com/device", href: "https://example.com/device" },
      { text: " and enter the code:", href: null },
    ])
  })

  test("a full stop after a link is a full stop", () => {
    // A CLI printing a sentence means the sentence, not a URL ending in `.`.
    expect(linkify("Go to https://example.com/device.")).toEqual([
      { text: "Go to ", href: null },
      { text: "https://example.com/device", href: "https://example.com/device" },
      { text: ".", href: null },
    ])
  })

  test("a bracketed link keeps the bracket the URL opened", () => {
    expect(linkify("(see https://example.com/a(b))")).toEqual([
      { text: "(see ", href: null },
      { text: "https://example.com/a(b)", href: "https://example.com/a(b)" },
      { text: ")", href: null },
    ])
  })

  test("nothing to link is one piece of text", () => {
    // Progress-bar output, prompts and errors are the common case.
    expect(linkify("Paste code here if prompted > ")).toEqual([
      { text: "Paste code here if prompted > ", href: null },
    ])
  })

  test("only http(s) counts", () => {
    // A scheme that is not a place to go — and `//host` with no scheme, which
    // would be a guess about prose rather than about a URL.
    expect(linkify("mailto:someone@example.com /* /dev/null */")).toEqual([
      { text: "mailto:someone@example.com /* /dev/null */", href: null },
    ])
  })
})
