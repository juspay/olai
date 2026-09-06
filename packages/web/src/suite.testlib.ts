/**
 * What the browser suite may see of this package — the WHOLE of it, listed.
 *
 * `./testlib` is the subpath @olai/format, @olai/git, @olai/log and
 * @olai/ops already publish for their tests' sake; why this package joined
 * them late is recorded where the deal was struck
 * (`https://github.com/juspay/oss.olai/blob/main/projects/olai/lowy-electricity/debate-2026-08-19.md`, finding 5). The suite used
 * to spell nineteen paths into `client/`'s own modules while the manifest
 * answered for none of them — two lies, one lie each end. One door retires
 * both: the suite imports this file and nothing deeper, and `exports` in the
 * manifest says exactly that. The argument that USED to keep the field empty
 * — "a declared export list would suggest a library this is not" — is met by
 * naming no `.`: the products remain a script (`src/build.ts`) and its dist,
 * and nothing imports an app.
 *
 * THE LIST IS THE SURFACE, and it is deliberately a list and not a layer:
 * every name below lives in the module that owns it, unchanged — a spelling
 * of it here would be the contract-kept-by-memory this door exists to end.
 *
 * ...AND EVERY NAME BELOW IS THIS PACKAGE'S OWN OR A FLOOR'S, which is the
 * newer half of the rule and the one that shrank the list. A line here that
 * re-exported a PLUGIN's constant was doing something a curated list cannot
 * make safe: five of them put `olai-plugin-files`, `olai-plugin-chat`,
 * `olai-plugin-layout` and `olai-plugin-outlines` in a general package's
 * manifest and on this door's import graph, for thirteen strings the suite
 * could ask the rows it is already driving. The rule is `@olai/bundle`'s
 * `fence.test.ts`: no general package names a plugin, held as an EQUALITY per
 * package, and `web`'s entry is `[]` in both of its tables. Where those five
 * lines went is the last section.
 *
 * Note the suffix is shared with a different tool: `client/preference.testlib.ts`
 * builds fixtures for THIS package's own suites and is
 * exported nowhere. Nothing the browser suite needs built is here because it
 * builds nothing in the client — it drives one, through a browser.
 *
 * THE FENCE HAS TWO ENDS, and @olai/tests' `imports.test.ts` sweeps both.
 * Its end: a step, a support file or a driver spells `@olai/web/testlib` and
 * nothing deeper. This end: no COMPONENT below, ever — a `.tsx` re-export
 * would drag its import graph into a process with no browser in it, and the
 * client's graph reaches `wire.ts`, which dials at module scope and throws
 * without a `location`. Not hypothetical, as that test's header tells: the
 * suite once died before its first scenario naming `connectSurface`, because
 * a NAMED CONSTANT it shared had been left inside a component. Which is why
 * the deadlines below live in `.ts` modules whose graphs never touch the
 * wire — a constant the suite shares belongs in a module that holds a
 * constant.
 *
 * Four groups, because the contract is four kinds of fact:
 */

// ── the NAMES a scenario finds things by ───────────────────────────────────
//
// A `data-testid` is a contract between two packages that never otherwise
// meet (testids.ts's opening paragraph): renamed, it compiles on both sides
// and fails as a bare timeout. What is left here is the READER of that
// contract rather than any table of names: `selector` is how a step turns an
// id into a query, and it is this package's because the attribute is. The
// tables it reads — which row one KIND of file draws, what one minting DOOR
// is called — belong to the rows that own those ids, and a step asks them
// directly (the last section).

export { selector } from "./client/testids.ts"
// The other name of that kind, and the only one that is not a testid: the
// attribute the app shell counts keys down on. It is the suite's ONE wait
// after a key — what the per-key receipts in `support/caret.ts` were
// approximating — and `client/quiescence.ts` is where the contract is: what
// holds the count, what deliberately does not, and why.
export { KEYS_SETTLING } from "./client/quiescence.ts"

// ── the CLOCK, and the DEADLINES a wait is measured against ────────────────
//
// A step that asserts "not yet" must outwait the number the client itself
// uses, and a number typed twice eventually disagrees — two spellings of
// "the day after today" is a scenario that passes 364 days a year
// (editing_steps' `tomorrow`'s own argument).

export { isoDayOf } from "./client/clock.ts"
export { LONG_PRESS_MS } from "./client/longPress.ts"

// ── what THIS BROWSER keeps, and the words it is kept under ────────────────
//
// A preference is a claim about one browser: stored in it, read back out of
// it, never sent anywhere. A scenario claiming "it is remembered" reads the
// key the client writes — and a key spelled twice is a check that passes
// against a client that moves. `theme/palettes.ts`'s own note in testids.ts
// is the rule stated: what the default is and where a pick is stored are not
// markup, so they are imported, which is a type error rather than a timeout
// the day one is renamed.

export { DEFAULT_THEME, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "@olai/appearance/palettes.ts"
export { SIZE_STORAGE_KEY } from "@olai/appearance/sizes.ts"
export { customProperty } from "@olai/appearance/css.ts"

// ── HOW THE PAGE SAYS ITS PLUGIN MODULES ARRIVED ───────────────────────────
//
// The one name that is neither a testid, a deadline nor a stored key: the
// element id the boot script hands the browser its module map on. A scenario
// about a plugin arriving or leaving has to find that map, and the id is
// `@olai/plugin-api`'s because the mount is.

export { BROWSER_MODULES_ID } from "@olai/plugin-api/mount"

// ── THE NAMES THAT LEFT WITH THEIR ROWS ────────────────────────────────────
//
// `NODE_REF`, `NEAR` and `completingIn` went first, when the panel became a
// row: the transcript, its autoscroll and the composer's trigger are
// `olai-plugin-chat/testlib`'s, and a curated list in a general package that
// re-exported them would be core naming a plugin.
//
// FIVE LINES FOLLOWED, for the same reason, and they are why nothing above
// reaches past this package's own `client/`, `@olai/appearance` and
// `@olai/plugin-api`:
//
//   - `ROW_TESTID` is `olai-plugin-files/kinds`' — which row one KIND of file
//     draws is that row's table;
//   - `Making`, `MAKING_DOCUMENT` and `MAKING_OUTLINE` are
//     `olai-plugin-files/making`'s — what a minting door is called is the
//     door's;
//   - `ALERT_SOUND_KEY` and `ALERTS_KEY` are `olai-plugin-chat/alert-keys`' —
//     the panel stores them, so the panel names them;
//   - `SIDEBAR_WIDTH_KEY` is `olai-plugin-layout/preferences`' — the chrome
//     that draws the sidebar is the chrome that remembers its width;
//   - `REFERRINGS`, `IDLE_COMMIT`, `DENSITY_KEY`, `Density`,
//     `DONE_HIDDEN_KEY` and `DONE_OVERRIDES_KEY` are
//     `olai-plugin-outlines/testlib`'s.
//
// A PASS-THROUGH IS NOT A SMALLER DEPENDENCY THAN AN IMPORT — it is the same
// edge with this package's name on it. Those five lines carried four of the
// seven plugin rows this package's manifest declared, for thirteen strings,
// while its own `//boundary` field claimed it imported none. The suite reaches
// every one of them on the owning row's door now, which is what the cucumber
// package is FOR: it drives plugins, so it names them, and `@olai/tests`' rows
// in `@olai/bundle`'s `fence.test.ts` record each line the way kolu's fake padi
// is recorded. `web` has no row in that table at all.
