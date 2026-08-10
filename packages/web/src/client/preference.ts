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
 */

/** What this browser remembers under `key`, or `null` for nothing — which is
 *  also the answer when storage refuses to be read. */
export const readPreference = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Remember it, or forget it with `null`. */
export const writePreference = (key: string, value: string | null): void => {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // A preference that cannot be remembered is still a preference for this
    // tab: every caller has already applied it.
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
