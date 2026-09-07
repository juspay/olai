/**
 * WHERE THE PHONE LAYOUT STOPS — the breakpoint, and nothing live.
 *
 * `md` in this app is 48rem — the same line the sidebar stops being a column
 * (`../Frame.tsx`, `@olai/ui-primitives`' `touch.ts`). One matchMedia rather
 * than two, so the layout and the finger-size rule cannot disagree about where
 * "phone" starts; the listener is `./media-owner.ts`'s and the reading is
 * `./live.ts`'s.
 *
 * THE SIGNAL LEFT THIS DOOR. It was here — one module-scoped `createSignal`
 * read by five other packages — so "is this a phone" crossed five package walls
 * as a module variable, with no dependency declared and a default of `false`
 * for any reader whose serve had no layout row at all (the audit's §12). The
 * reading is on `layout.shell` now (`../index.ts`).
 */

/** Tailwind's `md` default, and this app's phone/desktop split. */
export const DESKTOP_MQ = "(min-width: 48rem)"
