/**
 * Which tab of this browser records, when more than one is open.
 *
 * Two tabs on one directory are two copies of the same loop watching the same
 * published value, so they arm the same quiet window and it runs out for both
 * at once. Two commits then race for one work tree: the second finds the first
 * has taken the files, git answers "nothing to commit", and the loop stops with
 * a refusal that is nobody's fault — or worse, the two `git add`s interleave in
 * one index. Nothing in the server prevents it: one process per directory is
 * the fence olai has (`server/lock.ts`), and both tabs are inside it.
 *
 * So ONE TAB HOLDS A LOCK and it is that tab that records. The Web Locks API is
 * the browser's own mutex, scoped to the origin and shared across every tab of
 * it, and this is its canonical shape: request the lock and never release it —
 * the callback's promise is one that does not settle — so the holder keeps it
 * for the life of the document and the browser hands it to the next tab in the
 * queue the moment that document goes. There is no heartbeat, no timestamp, no
 * staleness window and no election protocol to get wrong, for the same reason
 * `server/flock.ts` gives about `flock(2)`: the claim belongs to something that
 * outlives the claimant's ability to clean up.
 *
 * A browser with NO Web Locks — an insecure origin, since this is a
 * secure-context API, or something old — gets `true`: every tab records, which
 * is what a single tab does anyway and is the behaviour there was before this
 * file existed. Refusing to auto-commit at all there would take the feature
 * away from a directory served over a LAN, which is a worse answer than the
 * rare double commit it would prevent.
 *
 * This says nothing about the Commit BUTTON. A person pressing it in either tab
 * is a person who meant it, and two people pressing at once is not a case a
 * lock is entitled to arbitrate.
 */

import { type Accessor, createSignal } from "solid-js"

/** The name the tabs contend for, namespaced like the preference it serves —
 *  locks are per origin, and a page served from a host that has other things on
 *  it must not be able to collide. */
export const AUTOCOMMIT_LOCK = "olai.git.autocommit"

/**
 * Whether THIS tab is the one that records.
 *
 * `false` until the lock is actually held, deliberately: a tab that assumed it
 * had won while the request was still queued would be exactly the double commit
 * this file exists to prevent. It never goes back to `false` — a lock this tab
 * holds is released by the document ending, and nothing here outlives that.
 */
export const createElected = (): Accessor<boolean> => {
  const locks = globalThis.navigator?.locks
  const [elected, setElected] = createSignal(locks === undefined)
  // Held for the life of the document: the promise below never settles, which
  // is how Web Locks spells "keep it". No teardown, for the reason
  // `../preference.ts`'s watcher has none — the only thing that could release
  // it is the thing that ends the page.
  if (locks !== undefined) {
    void locks.request(AUTOCOMMIT_LOCK, () =>
      new Promise<void>(() => {
        setElected(true)
      }))
  }
  return elected
}
