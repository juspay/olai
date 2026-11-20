/**
 * THE FENCE HAS TWO ENDS, and @olai/tests' `imports.test.ts` sweeps both.
 * Its end: a step, a support file or a driver spells `@olai/web/testlib` and
 * nothing deeper. This end: no COMPONENT below, ever — a `.tsx` re-export
 * would drag its import graph into a process with no browser in it, and the
 * client's graph reaches `wire.ts`, which dials at module scope and throws
 * without a `location`.
 */

export { selector } from "./client/testids.ts"
export { KEYS_SETTLING } from "./client/quiescence.ts"

export { isoDayOf } from "./client/clock.ts"
export { LONG_PRESS_MS } from "./client/longPress.ts"

export { DEFAULT_THEME, THEME_ATTRIBUTE, THEME_STORAGE_KEY } from "@olai/appearance/palettes.ts"
export { SIZE_STORAGE_KEY } from "@olai/appearance/sizes.ts"
export { customProperty } from "@olai/appearance/css.ts"

export { BROWSER_MODULES_ID } from "@olai/plugin-api/mount"

