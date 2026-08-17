/**
 * ONE attribute selector, with the value QUOTED SAFELY — the house idiom for
 * gripping a row by what it carries, spelled once for the whole suite.
 *
 * Sixty steps across seventeen files built a `[data-…="…"]` by pasting a value
 * into a template literal, and every one of them was a step away from a value
 * with a `"` in it. What that costs is not a missed match: a `"` ends the CSS
 * string early and Playwright refuses the whole selector, so the step dies
 * naming a parse error rather than the row it could not find. There is nothing
 * to harden in the APP — Solid sets dynamic attributes through `setAttribute`,
 * so the DOM is escaped by construction, and this is a test-selector concern
 * from end to end — which is exactly why hardening the newest instance alone
 * (PR #182's `data-from`, the fourth spelling of one idiom) was the wrong fix
 * and this is the right one.
 *
 * TWO CHARACTERS need escaping inside a CSS string and no more: the closing
 * quote and the backslash that would escape it, in that order — escaping the
 * quote first would turn a value's own trailing `\` into the escape for the
 * quote after it. A NEWLINE cannot appear raw in a CSS string at all, so it
 * becomes the character escape `\a `, where the trailing space terminates the
 * hex digits and is part of the escape rather than decoration. Everything else
 * — spaces, brackets, `#`, `.`, colons, emoji — is ordinary text inside quotes
 * and is deliberately left alone: escaping more than the grammar asks for is
 * how a selector stops matching the value it was built from, which looks
 * exactly like a missing element.
 *
 * The FULL attribute name, not a `data-` stem, so a call site still reads as
 * the attribute the client writes and `grep data-node-id` still finds both ends
 * of the contract.
 *
 * A MODULE OF ITS OWN rather than a function in `./world.ts`, where the rest of
 * the selector vocabulary lives and where every caller still reaches it — the
 * world re-exports it, so a step imports one name from one door. Importing
 * `./world.ts` STARTS CUCUMBER: it registers hooks and a default timeout at
 * load, and a `bun test` that wanted only this rule got an
 * invalid-installation error for its trouble. A rule with an edge in it that
 * can only be checked by driving a browser is a rule nobody checks, so the edge
 * is held next door in `../selectors.test.ts` and the browser's agreement is
 * held by a scenario (`features/serve_a_directory.feature`).
 *
 * FOUR SELECTORS IN THIS SUITE ARE NOT BUILT HERE, and each says so where it
 * is: they sit inside a `page.evaluate` callback, which is serialised and run
 * in the browser, where nothing in this module exists to be called. All four
 * interpolate a value from a CLOSED TABLE — a `TestId`, or a diff line's
 * `add`/`del`/`context` — so there is no value with a quote in it for them to
 * meet. `@olai/web`'s own `selector(id: TestId)` is the same case one package
 * over, and stays as it is for the same reason: its argument is a union of
 * kebab-case literals the type checker enforces, not text a reader typed.
 */
export const attr = (name: string, value: string): string =>
  `[${name}="${
    value.replace(/[\\"]/g, (char) => `\\${char}`).replace(/\n/g, "\\a ")
  }"]`;
