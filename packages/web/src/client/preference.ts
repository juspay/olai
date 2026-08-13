/**
 * What this BROWSER remembers about how it reads.
 *
 * Not state, and not settings: a preference here belongs to one browser, is
 * never sent anywhere, and the served directory neither knows nor cares — so
 * two machines reading the same outlines are entitled to disagree about the
 * theme and about whether the agent drawer is open.
 *
 * The whole of the mechanism is that storage CAN THROW — a browser with it
 * disabled, a private window at quota — and that a preference which cannot be
 * remembered is still a preference for this tab. Written once here, because
 * the alternative is every feature owning its own `try` and the third one
 * getting it slightly different from the first two.
 *
 * Keys are namespaced `olai.` so a page served from a host that has other
 * things on it cannot collide. The theme's key is also spelled in the shell's
 * boot script, which runs before any module exists (`index.html`).
 *
 * A preference belongs to the BROWSER, which is more than one tab. Two tabs on
 * the same outlines are one browser and one preference, so a theme picked in
 * one is not a thing the other is entitled to disagree with — it is the same
 * fact, and a sibling tab left in yesterday's palette until it is reloaded is
 * exactly "the one stale thing on the screen" that `clock.ts` argues no page
 * making this app's promise may have. `storage` is the browser's own event for
 * saying so, and it is fired only in the OTHER tabs: the tab that wrote has
 * already applied it.
 *
 * `@solid-primitives/storage`'s `makePersisted` was the other candidate here
 * and does sync across tabs. It is not adopted, for two reasons that are one
 * reason: the theme is not a signal that happens to be stored — `<html>` is
 * the state and the signal MIRRORS it (theme/state.ts), written first by a
 * boot script in the shell that has no modules to import — and this file's
 * contract is that storage may throw and the preference stands anyway, which
 * is a promise made here rather than one taken on trust from a dependency.
 * One mechanism for both preferences beats a second one for the one of them
 * that would fit.
 *
 * The CIRCUIT over these primitives — read the entry into a signal, write a
 * change back, follow the browser's other tabs — is {@link createPreference},
 * and every stored value this browser keeps runs on it, with ONE exception.
 * The theme cannot: its first read belongs to the shell's boot script, which
 * runs before any module exists, because a themed first paint cannot wait for
 * one — and `<html>` is the state its signal mirrors, so a second copy in a
 * signal here would be the disagreement theme/state.ts exists to prevent. So
 * theme/state.ts keeps its own wiring and imports the primitives, and a test
 * beside this file holds the line: nothing else may.
 */

import { type Accessor, createSignal } from "solid-js"

/** What this browser remembers under `key`, or `null` for nothing — which is
 *  also the answer when storage refuses to be read. */
export const readPreference = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * What a stored BOOLEAN says, and the one rule about reading one: only the word
 * this app writes is a pick, and everything else — a key nobody has ever set, a
 * value from an older olai, something typed into a console — is the caller's
 * own default.
 *
 * Here rather than beside any one preference, because it is the storage
 * convention rather than a fact about panels or about finished work: it is the
 * parse half of {@link boolCodec}, which every stored boolean this browser
 * keeps runs on. Two spellings of it is one place for it to change and another
 * to stay as it was.
 */
export const parseBool = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) return fallback
  return raw === "true"
}

/**
 * What a stored JSON value says, and `undefined` for everything that is not
 * one: a key nobody has set, a half-written entry, something typed into a
 * console.
 *
 * The same rule as {@link parseBool} and here for the same reason — it is the
 * storage convention rather than a fact about folds or about folders, and it is
 * now read by both of the stored values this browser keeps that are more than a
 * word (`fold/memory.ts`, `fold/folders.ts`). What SHAPE the answer has to have
 * is the caller's, because only the caller knows one; that it is not an error
 * to report is decided here, once.
 */
export const parsedJson = (raw: string | null): unknown => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Keys already complained about, so a picker somebody is playing with does
 *  not fill the console with the same sentence forty times. Once per key is
 *  enough to be findable and few enough to be read. */
const complained = new Set<string>()

/**
 * Remember it, or forget it with `null`.
 *
 * A preference that cannot be remembered is STILL a preference for this tab —
 * every caller has already applied it, and that contract stands. What was
 * missing is that nothing said so at all, so a browser with storage disabled
 * quietly forgot every theme pick between reloads and there was nowhere to
 * find out why.
 *
 * The console, and deliberately not a surface in the app. There is no screen
 * this belongs on: it is not about the outlines, it did not fail anything the
 * reader asked for, and a banner over somebody's tree saying their theme will
 * not persist is worse than the silence it replaced. This is the cheap half —
 * the thing a person is told when they go looking for why, which is exactly
 * when they open a console.
 */
export const writePreference = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch (cause) {
    if (complained.has(key)) return
    complained.add(key)
    console.warn(
      `olai: this browser will not store "${key}", so the setting holds for this tab and is forgotten on reload`,
      cause,
    )
  }
}

/**
 * What a `storage` event says about `key`: the value it now has, or `undefined`
 * when the event is not about it.
 *
 * Three answers rather than two, because there are three cases and the middle
 * one is the one that gets missed: an event whose own `key` is `null` is
 * `localStorage.clear()`, which cleared this preference along with everything
 * else — so it reports `null`, the same as a removal, and NOT "not about me".
 *
 * A plain function of the event so the decision can be tested without a second
 * tab. Deliberately no `storageArea` check: nothing in this app writes
 * `sessionStorage`, whose events are the only other source, and the keys are
 * namespaced against the rest of the host either way.
 */
export const preferenceChanged = (
  event: StorageEvent,
  key: string,
): string | null | undefined => {
  if (event.key === null) return null
  return event.key === key ? event.newValue : undefined
}

/**
 * Follow a preference for as long as this document lives: `apply` is called
 * with what ANOTHER tab left under `key`, and never with this tab's own writes.
 *
 * No teardown, for the same reason `viewport.ts` has none: what this belongs to
 * is the document, a preference outlives every component that reads one, and
 * the only thing that could end the listener also ends the page.
 */
export const watchPreference = (
  key: string,
  apply: (value: string | null) => void,
): void => {
  // `window.` spelled out: the bare global resolves to the untyped overload,
  // which hands a listener a plain `Event` and loses the whole point of asking
  // for this one.
  window.addEventListener("storage", (event) => {
    const value = preferenceChanged(event, key)
    if (value !== undefined) apply(value)
  })
}

/**
 * How one preference's VALUE relates to its stored string, which is the whole
 * of what distinguishes one preference from another: what the entry says —
 * where `null` is no entry at all, a browser never asked and storage refusing
 * to be read alike — and what to write back, where `null` is "remember
 * nothing", a key REMOVED rather than an empty husk left behind.
 *
 * `parse` owns the defaults, and owns them completely: a value this app did
 * not write — an older olai, something typed into a console — is not an error
 * to report, it is the default, and the codec is the one place that rule is
 * spelled for its key. That is also what makes following another tab safe:
 * whatever arrives goes through the same `parse` the first read did.
 */
export interface PreferenceCodec<T> {
  readonly parse: (raw: string | null) => T
  readonly print: (value: T) => string | null
}

/** The whole of `set`'s option surface, spelled once for the setters that
 *  forward it (layout/prefs.ts): `persist: false` applies a value WITHOUT the
 *  write — the drag handles' option, so a pointermove is not a storage write
 *  and a cross-tab event twenty times a second. */
export interface SetOptions {
  readonly persist?: boolean
}

/** One preference, wired: the value in force, the two ways it changes (this
 *  tab sets it; another tab's write arrives), and a read of the entry as it is
 *  now for the one preference whose writes MERGE (fold/memory.ts). */
export interface Preference<T> {
  /** The value in force for this tab. */
  readonly value: Accessor<T>
  /** Apply `next` to this tab and remember it — or, with {@link SetOptions}'
   *  `persist: false`, apply it to this tab alone. */
  readonly set: (next: T, opts?: SetOptions) => void
  /** What the entry says RIGHT NOW, not what this tab last saw: a sibling tab
   *  may have written since. For a preference that is a set of independent
   *  facts rather than one pick, a write starts from this. */
  readonly stored: () => T
  /** Follow the browser's other tabs for as long as this document lives —
   *  started once, from `main.tsx`, because a preference belongs to the
   *  browser and a browser is more than one tab. */
  readonly follow: () => void
}

/**
 * The read→signal→write→watch circuit, wired ONCE.
 *
 * Every stored key used to spell this by hand — five times in
 * `layout/prefs.ts` alone, and again for the folds, the sidebar's folders and
 * the done default — and the copies had begun to drift under maintenance. What
 * varies per key is only the codec; everything a codec cannot express is not a
 * preference's to vary. The one deliberate absence is the theme: its first
 * read is the boot script's (see the header), so it stays on the primitives,
 * and the claim test names it as the only client file allowed to.
 */
export const createPreference = <T>(
  key: string,
  codec: PreferenceCodec<T>,
): Preference<T> => {
  const [value, setValue] = createSignal(codec.parse(readPreference(key)))
  // Wrapped so a T that is itself a function could never be taken for Solid's
  // updater form.
  const hold = (next: T): void => void setValue(() => next)
  return {
    value,
    stored: () => codec.parse(readPreference(key)),
    set: (next, opts) => {
      hold(next)
      if (opts?.persist !== false) writePreference(key, codec.print(next))
    },
    follow: () => {
      watchPreference(key, (raw) => hold(codec.parse(raw)))
    },
  }
}

/** The codec every stored BOOLEAN runs on, spelled once beside the rule it
 *  parses with ({@link parseBool}) so the third boolean cannot get the print
 *  half slightly different from the first two. */
export const boolCodec = (fallback: boolean): PreferenceCodec<boolean> => ({
  parse: (raw) => parseBool(raw, fallback),
  print: String,
})
