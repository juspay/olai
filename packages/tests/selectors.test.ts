/**
 * The one quote-safe attribute selector, held to the CSS string grammar.
 *
 * `support/selectors.ts`'s `attr` — which `support/world.ts` re-exports, so a
 * step still imports it from the one door its other selectors come from — is
 * what every step in this suite now builds a `[data-…="…"]` through, and what
 * it replaced was sixty template literals each
 * pasting a value straight between two quotes. The failure that arrangement is
 * one value away from is not a missed row: a `"` ends the CSS string early,
 * Playwright refuses the whole selector, and the step dies naming a parse error
 * instead of the thing it could not find. Nothing in the APP is at risk — Solid
 * writes dynamic attributes through `setAttribute`, so the DOM is escaped by
 * construction — which is exactly why this is a test-selector rule and belongs
 * in a test of the tests.
 *
 * TWO CLAIMS, and they pull in opposite directions:
 *
 *   - **enough is escaped.** The closing quote and the backslash are the two
 *     characters a CSS string cannot carry raw; a newline is the third thing
 *     that cannot appear in one at all and becomes the character escape `\a `,
 *     trailing space included, because that space is what terminates the hex
 *     digits rather than decoration.
 *   - **and no more than enough.** A selector is not a shell command. Spaces,
 *     `#`, `.`, `[`, `:`, `>` and emoji are ordinary text INSIDE quotes, and
 *     escaping them is how a selector quietly stops matching the value it was
 *     built from — the failure that looks exactly like a missing element.
 *
 * The proof that the whole thing actually works in a BROWSER is not here and
 * cannot be: `bun test` has no DOM. It is
 * `features/serve_a_directory.feature`'s scenario about a file whose name
 * carries a quote, which grips that file through this very helper — a real
 * Chromium parsing a real selector against a real attribute. This file is the
 * grammar; that scenario is the engine agreeing with it.
 */

import { expect, test } from "bun:test";

import { attr } from "./support/selectors.ts";

test("an ordinary value is quoted and otherwise untouched", () => {
  expect(attr("data-node-id", "handles")).toBe(`[data-node-id="handles"]`);
  expect(attr("data-file", "notes/report.html")).toBe(`[data-file="notes/report.html"]`);
});

// The whole point. Without this the selector reads `[data-name="he said "hi""]`,
// which is not a selector at all.
test("a value carrying a quote closes nothing early", () => {
  expect(attr("data-name", `he said "hi"`)).toBe(`[data-name="he said \\"hi\\""]`);
  expect(attr("data-path", `a/"quoted"/dir.md`)).toBe(`[data-path="a/\\"quoted\\"/dir.md"]`);
  // A lone opening quote is the sharper half: the value that ends the string
  // and leaves the rest of the selector as garbage after it.
  expect(attr("data-key", `sa"y`)).toBe(`[data-key="sa\\"y"]`);
});

// A backslash is the other one, and it has to go first: escaping the quote
// without escaping the backslash turns `\` + `"` into an escaped quote that
// the value never meant, so `a\` and `a\"` would build the same selector.
test("a backslash is escaped, and before the quote it might otherwise arm", () => {
  expect(attr("data-key", `a\\`)).toBe(`[data-key="a\\\\"]`);
  expect(attr("data-key", `a\\"b`)).toBe(`[data-key="a\\\\\\"b"]`);
  expect(attr("data-key", `a\\`)).not.toBe(attr("data-key", `a\\"`));
});

// A newline cannot appear raw in a CSS string at all. `\a ` is the character
// escape for it — the trailing space terminates the hex digits and is part of
// the escape.
test("a newline becomes a character escape, space and all", () => {
  expect(attr("data-asked", "two\nlines")).toBe(`[data-asked="two\\a lines"]`);
});

// The other direction, and the one a "just escape everything" rewrite would
// break: inside quotes these are ordinary characters, and a selector that
// escaped them would stop matching the value it was built from.
test("nothing else is escaped, because inside quotes nothing else needs to be", () => {
  for (
    const value of [
      "a b",
      "kitchen #home",
      "2026-08-11",
      "a.b:c",
      "[bracketed]",
      "one > two",
      "50%",
      "café ☕",
      "a'b",
    ]
  ) {
    expect(attr("data-value", value), value).toBe(`[data-value="${value}"]`);
  }
});

// The empty value is a real one — an attribute present and blank — and it is a
// valid selector rather than something to guard against.
test("an empty value is an empty string, not a missing one", () => {
  expect(attr("data-value", "")).toBe(`[data-value=""]`);
});
