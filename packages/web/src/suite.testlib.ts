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
 * Note the suffix is shared with a different tool: `client/frame.testlib.ts`
 * and its siblings build fixtures for THIS package's own suites and are
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
// and fails as a bare timeout. The small tables below it are the same kind
// of fact one level up — what one KIND of file's row, one minting DOOR or
// one WAY of referring is called to a test — each a single decision that a
// projection spelled at a call site would drift from.

export { selector, TESTID, type TestId } from "./client/testids.ts"
// The other name of that kind, and the only one that is not a testid: the
// attribute the app shell counts keys down on. It is the suite's ONE wait
// after a key — what the per-key receipts in `support/caret.ts` were
// approximating — and `client/quiescence.ts` is where the contract is: what
// holds the count, what deliberately does not, and why.
export { KEYS_SETTLING } from "./client/quiescence.ts"
export { ROW_TESTID } from "./client/file/kinds.ts"
export { type Making, MAKING_DOCUMENT, MAKING_OUTLINE } from "./client/file/making.ts"
export { REFERRINGS } from "./client/backlinks/way.ts"
export { NODE_REF } from "./client/chat/refs.ts"

// ── the CLOCK, and the DEADLINES a wait is measured against ────────────────
//
// A step that asserts "not yet" must outwait the number the client itself
// uses, and a number typed twice eventually disagrees — two spellings of
// "the day after today" is a scenario that passes 364 days a year
// (editing_steps' `tomorrow`'s own argument).

export { isoDayOf } from "./client/clock.ts"
export { IDLE_COMMIT } from "./client/edit/draft.ts"
export { LONG_PRESS_MS } from "./client/longPress.ts"
export { NEAR } from "./client/chat/near.ts"

// ── what THIS BROWSER keeps, and the words it is kept under ────────────────
//
// A preference is a claim about one browser: stored in it, read back out of
// it, never sent anywhere. A scenario claiming "it is remembered" reads the
// key the client writes — and a key spelled twice is a check that passes
// against a client that moves. `theme/palettes.ts`'s own note in testids.ts
// is the rule stated: what the default is and where a pick is stored are not
// markup, so they are imported, which is a type error rather than a timeout
// the day one is renamed.

export { ALERT_SOUND_KEY, ALERTS_KEY } from "./client/settings/alerts.ts"
export { DENSITY_KEY, type Density } from "./client/settings/density.ts"
export { DONE_SHOWN_KEY } from "./client/settings/done.ts"
export { SIDEBAR_WIDTH_KEY } from "./client/layout/prefs.ts"
export { DEFAULT_THEME, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "./client/theme/palettes.ts"
export { SIZE_STORAGE_KEY } from "./client/theme/sizes.ts"
export { customProperty } from "./client/theme/css.ts"

// ── a read where no attribute carries the fact ─────────────────────────────
//
// The suite asks the client's OWN question rather than re-deciding it: which
// trigger the composer has armed for this draft.

export { completingIn } from "./client/chat/completion.ts"
