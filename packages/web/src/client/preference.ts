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
