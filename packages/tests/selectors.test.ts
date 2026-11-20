import { expect, test } from "bun:test";

import { attr } from "./support/selectors.ts";
import { read, tracked, withoutComments } from "./support/sweep.ts";

test("an ordinary value is quoted and otherwise untouched", () => {
  expect(attr("data-node-id", "handles")).toBe(`[data-node-id="handles"]`);
  expect(attr("data-file", "notes/report.html")).toBe(`[data-file="notes/report.html"]`);
});

test("a value carrying a quote closes nothing early", () => {
  expect(attr("data-name", `he said "hi"`)).toBe(`[data-name="he said \\"hi\\""]`);
  expect(attr("data-path", `a/"quoted"/dir.md`)).toBe(`[data-path="a/\\"quoted\\"/dir.md"]`);
  expect(attr("data-key", `sa"y`)).toBe(`[data-key="sa\\"y"]`);
});

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

test("an empty value is an empty string, not a missing one", () => {
  expect(attr("data-value", "")).toBe(`[data-value=""]`);
});

test("a token match escapes its value exactly as equality does", () => {
  expect(attr("data-blocked", "order", "~=")).toBe(`[data-blocked~="order"]`);
  expect(attr("data-blocked", `sa"y`, "~=")).toBe(`[data-blocked~="sa\\"y"]`);
  expect(attr("data-blocked", "order")).toBe(`[data-blocked="order"]`);
});

const BUILT_BY_HAND =
  /\[(?:[a-zA-Z-]+|\$\{[^}]*\})[~^|*$]?=\s*(?:"\$\{[^}]*\}"|'\$\{[^}]*\}'|\$\{[^}]*\})\]/g;

const SUITE =
  /^(?:packages\/tests\/(?:step_definitions|support)\/[^/]+\.ts|packages\/plugins\/[^/]+\/e2e\/.+\.ts)$/;

const BY_HAND: ReadonlyArray<string> = [
  `packages/plugins/chat/e2e/steps/chat_steps.ts: [data-kind="\${kind}"]`,
];

test("the pattern reads the shape, not one spelling of it", () => {
  for (
    const shape of [
      `[data-node-id="\${id}"]`,
      `[data-blocked~="\${blocker}"]`,
      `[\${attribute}="\${expected}"]`,
      `html[\${THEME_ATTRIBUTE}="\${theme}"]`,
      `[data-value='\${value}']`,
      `[data-value=\${value}]`,
    ]
  ) {
    expect(new RegExp(BUILT_BY_HAND.source).test(shape), shape).toBe(true);
  }
});

test("the pattern leaves alone what carries no interpolated value", () => {
  for (
    const shape of [
      `[\${CHAT_NODE_REF_ATTR}]`,
      `[data-testid="node"]`,
      `:not([\${attribute}])`,
      `\${selector}[\${at}] is not rendered`,
    ]
  ) {
    expect(new RegExp(BUILT_BY_HAND.source).test(shape), shape).toBe(false);
  }
});

test("no step builds an attribute selector by hand, but the browser entry-kind check", () => {
  const found = tracked(import.meta.filename)
    .filter((file) => SUITE.test(file))
    .flatMap((file) =>
      [...withoutComments(read(file)).matchAll(BUILT_BY_HAND)].map((hit) =>
        `${file}: ${hit[0]}`
      )
    )
    .sort();
  expect(found).toEqual([...BY_HAND].sort());
});
