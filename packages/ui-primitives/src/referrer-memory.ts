/**
 * A REFERRED-TO SECTION'S OPEN-STATE MEMORY, minted by the scope that mounts
 * it.
 *
 * The section (`@olai/markdown-ui`'s `ReferrersSection`) is a `<details>`: it
 * is the browser's own `open` attribute, inside a component that exists for
 * as long as the place it describes. The reader's answer was historically a
 * module-level `WeakMap` in the outlines plugin, cleared by hand on dispose —
 * shared activation state at package scope for a value that belongs to one
 * activation. This is the brief's ruling: the memory is a resource like any
 * other, created and withdrawn with the plugin's activation scope.
 *
 * The SHAPE here is the same as `heldService`'s — a factory the caller mints
 * its own of, private to its module — but the value is a WRITE cache, not a
 * single slot: what is remembered is the open/closed answer for each
 * (pane, place) the section has been drawn for, and the memory must survive
 * the component remounting while the plugin that owns it stays mounted (a
 * rebuild of the same pane and node, the `docs/format.md` promise), and be
 * gone with the activation that created it.
 *
 * WHERE THE STATE LIVES is the caller's: a plugin's `browser.tsx` activation
 * calls {@link createReferrerMemory} inside its `createRoot` closure and
 * holds it through {@link heldService} — the same channel every other
 * browser service travels, so components read it with a tracked accessor and
 * the hold clears by identity when the activation stops.
 *
 * ## What empties it
 *
 * The section is remembered under the caller's (pane, place) key. Two things
 * remove an entry:
 *
 *   - {@link ReferrerMemory.forget}, which the caller invokes when the place
 *     has nothing to say — a section that left because the last reference went
 *     away must come back COLLAPSED when a reference returns, which is the
 *     answer the reader was never asked a second time about.
 *   - the activation's own release: an own-plugin flip disposes the scope,
 *     and with it every answer the reader had given it.
 *
 * Everything else — a navigation that changes the place — is the caller's
 * own cleanup: the wrapper FORGETS a key when the place it names leaves the
 * screen (the section is unmounting for the last reference, or the reader
 * navigated away), so "navigating away starts a new visit" is true because
 * the memory was empty when the visit ended, not because the key changed.
 * Across a remount that keeps the same (pane, place) — a rebuild in place —
 * the caller remembers through the same key and the answer survives. The
 * memory answers only the question the element cannot: "was this left open
 * the last time it was mounted?"
 */
export interface ReferrerMemory {
  /** The remembered open states, keyed by the caller's (pane, place) key, or
   *  nothing when the section has never been touched on this place. */
  readonly opened: ReadonlyMap<string, boolean> | undefined
  /** Remember one key's state, called when the section is OPENED or SHUT by
   *  the reader. Written on the toggle rather than on cleanup: a navigation
   *  that discards the element has nothing to write, and "navigating away
   *  starts a new visit" falls out of the caller's keying (a revisited place
   *  is a new key, whose map this never touched). */
  readonly remember: (key: string, open: boolean) => void
  /** Drop one key's memory — called when the place has nothing to say, so a
   *  section that reappears after emptiness starts collapsed. */
  readonly forget: (key: string) => void
}

/** One activation's memory. `undefined` the first time a place is drawn —
 *  the honest nothing, which is also the section's default: collapsed. */
export const createReferrerMemory = (): ReferrerMemory => {
  const opened = new Map<string, boolean>()
  return {
    opened,
    remember: (key, open) => { opened.set(key, open) },
    forget: (key) => { opened.delete(key) },
  }
}