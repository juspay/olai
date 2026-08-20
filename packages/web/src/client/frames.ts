/**
 * HOW MANY FRAMES a subscription's value has moved on — counted off the STORE
 * it was written into, without copying it.
 *
 * ## What this replaces, and why it is a file
 *
 * A page reading is a stream, and two readers need to know THAT it moved rather
 * than what moved: the filter, whose answer about which nodes a query selects
 * may not outlive the set it was computed over (`./filter/asking.ts`'s
 * `Ask.at`), and the row editor, which suppresses a blur while it waits for the
 * frame that redraws a row it just moved (`./edit/editing.tsx`'s `settling`).
 * Neither can read the VALUE's identity: a subscription's value is a reconciled
 * store, so its identity survives every frame and its fields move underneath.
 *
 * The obvious answer — `Subscription.updated`, the framework's own change
 * signal — costs more than the fact is worth. Registering ANY handler switches
 * `@kolu/surface`'s `createUpdatedTracker.noteFrame` out of its O(1) hot path
 * and into a deep `framesEqual` walk of the whole page PLUS two
 * `structuredClone`s of it, per frame, to hand over a `{prev, next}` pair this
 * client throws away to bump an integer. Two deep copies of a hundred-kilobyte
 * page per keystroke, for a number
 * (docs/brainstorming/reactivity-after-the-flip.md §3.6).
 *
 * So the count is taken from the other side of the write: the STORE says a
 * frame landed, because a frame landing is precisely what writes it.
 *
 * ## Why so few nodes have to be watched
 *
 * `@kolu/surface`'s `writeValue.ts` merges every frame with
 * `reconcile(next, { key: null })` and no `merge`, and that one decision is
 * what makes this cheap. Under it Solid's `applyState`:
 *
 *   - descends into plain OBJECTS, writing each changed field with
 *     `setProperty` — which bumps that object's own `$SELF` node, the one
 *     `[$TRACK]` subscribes to. So one `[$TRACK]` per object covers every
 *     scalar under it;
 *   - REPLACES every element of an ARRAY, because nothing off a wire is `===`
 *     the element it supersedes — which bumps the ARRAY's `$SELF`. So one
 *     `[$TRACK]` on an array covers everything inside every element of it,
 *     however deep, and the elements never have to be walked at all.
 *
 * What is left to visit, therefore, is the object spine ABOVE the arrays — for
 * a `PageReading` a handful of nodes, whatever the page holds — so this is O(1)
 * in the size of the page where the tracker it replaces was O(page) three times
 * over. The bound is the SCHEMA's object nesting rather than the data's: a page
 * reading that one day carried a record keyed by node ids would put the size of
 * that record back into this walk, because a record is an object and objects are
 * what the spine is made of.
 *
 * **That is a claim about the framework, and `./frames.browsertest.ts` pins
 * it.** The day `@kolu/surface` lets a stream DECLARE an array key
 * (`reactivity-after-the-flip.md` §3.5's 5.1, which would recycle elements
 * instead of replacing them), the second bullet stops being true and the walk
 * below must descend into array elements. The test that replays a frame
 * differing only INSIDE an element is what will say so, rather than a filter
 * that quietly stopped re-asking.
 *
 * ## The law it keeps
 *
 * The same one `Subscription.updated` kept, because its readers were written
 * against it: a FIRST frame is a value rather than news and does not count, and
 * a value blanking to `undefined` — which is what the framework does to every
 * subscription the moment its input moves — is not a frame either. What it does
 * NOT keep is "an equal reconnect snapshot is silent": an identical frame is
 * still a write, every array element in it is still replaced, and every reader
 * of the store sees that — so this counts what the STORE did, which is the
 * honest thing for a counter whose readers are downstream of the store.
 *
 * WHAT THAT COSTS, named rather than implied: a transparent reconnect whose
 * snapshot changed nothing now moves this count, so a filtered page asks the
 * matcher once more than it strictly had to. That is the direction
 * `./filter/asking.ts`'s own header already asks for — "a reconnect re-opens
 * the subscription with a full snapshot… and the question this door is standing
 * on is asked again against the wire that came back" — and it is one call, once,
 * on an event a reader can see happen.
 *
 * ## And the day it can go
 *
 * THIS FILE IS A STAND-IN, which is the other half of the same doc:
 * `reactivity-after-the-flip.md` §3.5's **5.2** asks kolu for a tracker mode
 * that COUNTS WITHOUT CLONING, and `createSubscription.ts`'s `noteFrame` already
 * sees every frame — a counter bumped there is O(1), reads no store, and cannot
 * be wrong about a merge policy or about a reconnect. The plan (§5's PR 4)
 * allowed a store version on this side if that had not landed, on condition of
 * saying so; this is the saying-so. When 5.2 lands, `createReading` reads the
 * framework's counter and this file and its browsertest go with it.
 */

import { $TRACK, type Accessor, createMemo } from "solid-js"
import { unwrap } from "solid-js/store"

/**
 * Subscribe to every node of a store value that a frame could write to — see
 * the header for why the arrays are where this stops.
 *
 * `[$TRACK]` is read for its side effect (Solid's proxy subscribes the running
 * computation to that node's own signal) and the value is discarded. It is the
 * WHOLE subscription: `setProperty` bumps the changed property's node and its
 * object's `$SELF` together, so one `$SELF` per node covers every scalar under
 * it and a per-property subscription would be a second link to the same fact.
 *
 * THE CHILDREN ARE FOUND ON THE RAW VALUE, which is the difference between this
 * costing the spine and costing the page. Every read through a store proxy is a
 * trap: `Object.keys` runs `[[GetOwnProperty]]` per key, which mints a
 * descriptor object and a bound getter each time, and every scalar read creates
 * a signal node this does not need. `unwrap` is O(1) — the proxy hands back the
 * object it wraps — so the walk enumerates plain properties and reaches through
 * the proxy only for the handful that are objects, which is exactly the set that
 * has to be tracked anyway.
 */
const track = (value: unknown): void => {
  if (value === null || typeof value !== "object") return
  void (value as Record<symbol, unknown>)[$TRACK]
  // An array's own node is the whole of it — every element is replaced per
  // frame, so nothing inside one can change without this having heard.
  if (Array.isArray(value)) return
  const raw = unwrap(value) as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    const child = raw[key]
    if (child !== null && typeof child === "object") {
      track((value as Record<string, unknown>)[key])
    }
  }
}

/**
 * A count of the frames `value` has been written with, as a signal.
 *
 * `value` is a subscription accessor — `undefined` before its first frame and
 * again the moment its input moves. It is read here rather than handed over as
 * a store, because that is the shape every caller already has.
 */
export const createFrames = (value: Accessor<unknown>): Accessor<number> => {
  /** Whether the value now in the store is one a frame put there. Not a signal:
   *  it is read and written only by the memo below, in its own run. */
  let arrived = false
  return createMemo<number>((was) => {
    const now = value()
    if (now === undefined || now === null) {
      // A blank is the framework re-arming for a new question, so the frame
      // that answers it is a first frame again.
      arrived = false
      return was
    }
    track(now)
    if (!arrived) {
      arrived = true
      return was
    }
    return was + 1
  }, 0)
}
