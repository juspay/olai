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
 * `features/it_stays_live.feature`'s scenario about an outline whose file name
 * carries a quote, which grips that file through this very helper — a real
 * Chromium parsing a real selector against a real attribute. This file is the
 * grammar; that scenario is the engine agreeing with it.
 */

import { expect, test } from "bun:test";

import { attr } from "./support/selectors.ts";
import { read, tracked, withoutComments } from "./support/sweep.ts";

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

// The matcher rides in front of the same quoted string, so the escaping is the
// rule's whatever the comparison is. `~=` is the space-separated token match a
// step needs when an attribute LISTS things — `data-blocked` names every
// blocker — and the value it is asked about is a node id a scenario typed.
test("a token match escapes its value exactly as equality does", () => {
  expect(attr("data-blocked", "order", "~=")).toBe(`[data-blocked~="order"]`);
  expect(attr("data-blocked", `sa"y`, "~=")).toBe(`[data-blocked~="sa\\"y"]`);
  expect(attr("data-blocked", "order")).toBe(`[data-blocked="order"]`);
});

/**
 * …and the rule is a FENCE, not a tidy-up, because the thing it is about is
 * drift.
 *
 * `data-from` was the fourth spelling of one house idiom when PR #182 met it
 * (`data-path`, `data-file`, `data-node-id` were the first three), and
 * hardening the newest one alone was refused precisely because a suite where
 * some steps are careful and some are not teaches the next step to be careless.
 * Sixty call sites now go through `attr`; nothing but this stops the
 * sixty-first from being written the old way, in a step whose value happens
 * never to carry a quote — which passes for a year and then does not.
 *
 * The expectation is an EQUALITY to a named list rather than "empty", the way
 * every sweep in `@olai/tests` is written: a pattern that rotted would report
 * nothing here — a green run that checked nothing — instead of failing.
 *
 * COMMENTS STRIPPED, since the claim is about code and the prose above is free
 * to quote what it hunts. This file is excluded outright for the same reason
 * one sweep further along: it quotes the shape in an assertion, and a sweep
 * that caught its own net teaches the next reader to weaken the pattern.
 *
 * THE PATTERN IS THE WHOLE OF WHAT THIS OWNS, and its first draft owned one
 * spelling of four. A fence that reads `[` + a literal name + `="${…}"` misses
 * every other way the same defect is written, and this suite had five of them:
 * a MATCHER other than `=` (`[data-blocked~="${blocker}"]`, whose value is a
 * node id a scenario types), an interpolated NAME (`[${attribute}="${expected}"]`
 * in the world's own `expectAttribute`, which is the highest-traffic one there
 * is, plus `chatNodeRef` and the theme and font steps' `html[${ATTR}="${…}"]`).
 * None of them was safe on purpose; they were safe because no scenario had yet
 * typed a quote. All five go through `attr` now, and the pattern below reads
 * the shape rather than one spelling of it: either kind of name, any of the six
 * matchers, and a value quoted either way or not at all. It over-matches by
 * construction, which is the correct direction — a false alarm is a line a
 * human reads and answers, and a miss is this paragraph again in a year.
 *
 * WHAT IT SCANS is `step_definitions/` and `support/`, which is the SUITE — the
 * code a scenario drives, where every value in a selector arrived as a Gherkin
 * argument or was read back out of the page. `evidence.ts` is deliberately
 * outside it and carries a hand-built `[data-node-id="${id}"]` of its own: it is
 * a script somebody runs to take screenshots for a PR, its ids are its own
 * literals a few lines up, and nothing a reader typed ever reaches it. That is
 * the boundary, stated rather than left to be inferred from the glob.
 *
 * Writing the first draft found a hole in the stripper itself, which is the
 * sort of thing a fence is for: it reported three of the four selectors below,
 * because a MIME type with a star in it inside a line comment opened a block
 * comment that ran sixty lines past the fourth. `support/sweep.ts` takes
 * comments in ONE left-to-right pass now, and says why.
 */
const BUILT_BY_HAND =
  /\[(?:[a-zA-Z-]+|\$\{[^}]*\})[~^|*$]?=\s*(?:"\$\{[^}]*\}"|'\$\{[^}]*\}'|\$\{[^}]*\})\]/g;

/**
 * Every selector still built by hand, and why each may be.
 *
 * All four sit inside a `page.evaluate` callback, which is serialised and run
 * in the browser where nothing importable exists to be called — and all four
 * interpolate a value from a CLOSED TABLE, a `TestId` or a diff line's
 * `add`/`remove`/`same`, so there is no value with a quote in it for them to
 * meet. Listed by the TEXT they match rather than by line, so the list survives
 * an edit above them and still names exactly four things.
 */
const BY_HAND: ReadonlyArray<string> = [
  `step_definitions/chat_steps.ts: [data-kind="\${kind}"]`,
  `step_definitions/chat_steps.ts: [data-testid="\${at}"]`,
  `step_definitions/chat_steps.ts: [data-testid="\${at}"]`,
  `step_definitions/chat_steps.ts: [data-testid="\${at}"]`,
];

// The FENCE'S OWN EDGE, and the reason this test is here rather than trusted:
// the first draft of the pattern read `[` + a literal name + `="${…}"` and was
// blind to five real call sites in this suite. A fence is only worth what its
// pattern covers, so the shapes it must catch are spelled out — including the
// three it once missed. Every one of these is the same defect wearing different
// punctuation.
test("the pattern reads the shape, not one spelling of it", () => {
  for (
    const shape of [
      `[data-node-id="\${id}"]`,
      // A matcher other than plain equality.
      `[data-blocked~="\${blocker}"]`,
      // A name that is itself interpolated — `expectAttribute`'s shape, which
      // is the one most steps reach the DOM through.
      `[\${attribute}="\${expected}"]`,
      `html[\${THEME_ATTRIBUTE}="\${theme}"]`,
      // …and the two quotings nothing writes today but nothing forbids either.
      `[data-value='\${value}']`,
      `[data-value=\${value}]`,
    ]
  ) {
    expect(new RegExp(BUILT_BY_HAND.source).test(shape), shape).toBe(true);
  }
});

// …and what it must NOT claim, since a fence that cried wolf would be turned
// off. An attribute with no value escapes nothing, and a literal value is not
// built from anything a reader typed.
test("the pattern leaves alone what carries no interpolated value", () => {
  for (
    const shape of [
      `[\${CHAT_NODE_REF_ATTR}]`,
      `[data-testid="node"]`,
      `:not([\${attribute}])`,
      // A failure MESSAGE that happens to read like a selector.
      `\${selector}[\${at}] is not rendered`,
    ]
  ) {
    expect(new RegExp(BUILT_BY_HAND.source).test(shape), shape).toBe(false);
  }
});

test("no step builds an attribute selector by hand, but the four that must", () => {
  // `tracked` leaves the caller out of its own listing, which is what excludes
  // this file — it quotes the shape it hunts, in an assertion above.
  const found = tracked(import.meta.filename)
    .filter((file) =>
      /^packages\/tests\/(step_definitions|support)\/[^/]+\.ts$/.test(file)
    )
    .flatMap((file) =>
      [...withoutComments(read(file)).matchAll(BUILT_BY_HAND)].map((hit) =>
        `${file.slice("packages/tests/".length)}: ${hit[0]}`
      )
    )
    .sort();
  expect(found).toEqual([...BY_HAND].sort());
});
