/**
 * Editing a chip in place: what a commit would send, and when it sends nothing.
 *
 * The silent cases are the ones worth the file. A gesture that reaches a
 * refusal is worse than one that does nothing, and "open a chip and click away"
 * is a gesture somebody makes by accident several times a minute.
 */

import { expect, test } from "bun:test"

import { type ClosedBy, type Editing, leavingCommits, openedOn, sending, writes } from "./editor.ts"

const PR = { key: "pr", value: "https://x/1" }

test("changing a value is a write, and the key comes from the property, not the box", () => {
  expect(writes(PR, "pr", "https://x/2")).toBe(true)
  expect(sending(PR, "anything at all", "https://x/2"))
    .toEqual({ key: "pr", value: "https://x/2", was: "https://x/1" })
})

test("clearing the value is a write, and it is the REMOVAL — the op's own reading", () => {
  // `set_prop` with `""` takes the key off, exactly as `null` does
  // (`@olai/ops`' plan). The face offers what the tool offers.
  expect(writes(PR, "pr", "")).toBe(true)
  expect(sending(PR, "pr", "")).toEqual({ key: "pr", value: "", was: "https://x/1" })
})

test("changing nothing writes nothing — a chip opened and left alone is silent", () => {
  expect(writes(PR, "pr", "https://x/1")).toBe(false)
})

test("a new property needs a key and something to hold", () => {
  expect(writes(null, "agent", "claude-opus")).toBe(true)
  // A blank key is not a key — the ops layer refuses one in those words, and
  // there is nothing here for it to say it about.
  expect(writes(null, "", "claude-opus")).toBe(false)
  expect(writes(null, "   ", "claude-opus")).toBe(false)
  // ...and a new key with an empty value would be the removal of a key that is
  // not there, which is the one thing `set_prop` refuses about removals. So
  // `+` and then Enter is a way out rather than a complaint.
  expect(writes(null, "agent", "")).toBe(false)
})

test("a new key is trimmed, because a key is a name and the space around one is nobody's", () => {
  expect(sending(null, "  agent  ", "claude-opus"))
    .toEqual({ key: "agent", value: "claude-opus", was: null })
  // The VALUE is not trimmed: it is somebody's text, and a sentence that ends
  // in a space is still that sentence.
  expect(sending(null, "merge", "the human approves ").value).toBe("the human approves ")
})

test("the snapshot is the write's condition — the one the editor opened on, or none at all", () => {
  // The wire's `was`: the wire value of the SNAPSHOT, not the box's key — an
  // OPEN chip name-checks the value it was opened on…
  expect(sending(PR, "pr", "https://x/2").was).toBe("https://x/1")
  // …and an ADD names absence: `null`, not a value — the key should not be
  // there when the value lands, or somebody else's write is underneath and
  // the call refuses.
  expect(sending(null, "pr", "https://x/2").was).toBeNull()
})

// ── one gesture, one outcome ──────────────────────────────────────────

/**
 * The box's OWN WIRING, spelled the way `./PropsDrawer.tsx`'s `Chip`'s editor
 * wires it: one answer-record minted beside the `Box` by the caller that
 * CLOSES it (never inside the box's key handling — a box cannot know whether
 * its `onCommit` closes it; the add chip's key box's Enter only moves the
 * caret), and `onLeave` is the blur. The pin drives the sequence because what
 * is pinned here IS the sequence — the gestures, and the sends they produce.
 *
 * The ADD chip answers the SAME law through a SECOND record on the chip's own
 * element (`NewChip`'s `answeredBy`): its echo is the run's `onFocusOut`, not
 * a value box's `onBlur` — the value box there has no `onLeave` — so this
 * double cannot see its Enter wrapper at all, dishonest or dropped. The
 * first-add scenario in `properties.feature` is that half's only lock.
 */
const editor = () => {
  const sent: Array<"enter's write" | "the blur's write"> = []
  /** Which SNAPSHOT each send rode in on — the wire half's `was`: the shape
   *  of the claim that a blur may decide WHETHER it sends but never WHAT
   *  (grok's axis 2, quoted at the test below). */
  const carried: Array<Editing | null> = []
  /** One OPEN's answer-record. */
  let answeredBy: ClosedBy = null
  /** The SNAPSHOT `PropsDrawer.tsx`'s `Chip` reads once at the draw and never
   *  calls back — `null` for a key being added. Minted by `open`, because the
   *  world the editor was opened on IS one of the things a fresh open
   *  re-decides. */
  let snapshot: Editing | null = null
  return {
    sent,
    carried,
    /**
     * OPEN the box — and REOPEN is the same verb. THE REMOUNT IS THE LAW,
     * named rather than inherited: in production the record is a `let`
     * inside the editor's component, and the `<Show>` that mounts the box
     * DISPOSES it on the close, so a close is also the reset. A keep-alive
     * editor that HIDES the box (or a `keyed` `<Show>` that preserves the
     * child) would hold the previous open's answer — a settled design
     * decision the pins are written against: `properties.feature`'s
     * same-chip-twice scenario drives the real remount, and this file makes
     * "reopen" a gesture a test must choose to skip.
     *
     * And the ORDER of the two locks is worth keeping straight (Opus, review
     * 2 of 2): BROWSER first, this double second — the scenario failing at
     * its `editor is closed` step under a keep-alive editor is the claim;
     * this sequence is the reading of it.
     */
    open: (on: Editing | null = null) => {
      answeredBy = null
      snapshot = on
    },
    // Enter as the caller answers it: the wrapper records the close it is
    // about to own, and then the commit sends.
    enter: () => {
      answeredBy = "enter"
      sent.push("enter's write")
      carried.push(snapshot)
    },
    escape: () => {
      answeredBy = "escape"
    },
    // The blur, firing when it fires: leaving the box — OR the unmount the
    // commit's close just caused; the machine is not told which, which is the
    // whole point. The `sent` log counts SENDS, which is the one place a
    // stand-down can be counted at all: what a send DRAWS (the write landing,
    // the gate's refusal) is the browser suite's half.
    blur: () => {
      if (leavingCommits(answeredBy)) {
        sent.push("the blur's write")
        carried.push(snapshot)
      }
    },
  }
}

test("one Enter, one commit — the blur its close fires stands down", () => {
  // THE PINNED ONE (chip-blur-double-commit-2): this sequence used to be TWO
  // sends — the commit, then the blur the commit's close fired, sending the
  // same write again — and the ops layer's no-change guard drew that second
  // send as the spurious "already says … — nothing would change" note under
  // the run.
  const gestures = editor()
  gestures.open()
  gestures.enter()
  gestures.blur() // the one the unmount fires
  expect(gestures.sent).toEqual(["enter's write"])
})

test("a second open answers for itself — the record is born with the open", () => {
  // `leavingCommits("enter")` is false FOREVER: a record held past its close
  // turns the next open's LEAVING into a swallowed commit — a typed change
  // that never sends, which is the same bug reborn as a silent miss and
  // worse than the note it replaced. The keep-alive editor this fails under
  // is why `open` above is a verb and not an accident of the mint.
  const gestures = editor()
  gestures.open()
  gestures.enter()
  gestures.blur()
  gestures.open()
  gestures.blur()
  expect(gestures.sent).toEqual(["enter's write", "the blur's write"])
})

test("still once on the way out: leaving the box IS the commit", () => {
  // The path the fix could break: with no key pressed, the blur is the
  // gesture, and taking it away would be curing the echo by silencing the
  // speaker.
  const gestures = editor()
  gestures.open()
  gestures.blur()
  expect(gestures.sent).toEqual(["the blur's write"])
})

test("Escape abandons — and the blur its close fires writes nothing", () => {
  const gestures = editor()
  gestures.open()
  gestures.escape()
  gestures.blur()
  expect(gestures.sent).toEqual([])
})

test("the blur's commit rides in on the very snapshot Enter's would — one open, one answer", () => {
  // grok's axis-2 handoff flag, pinned where it can go red: the stand-down
  // law decides WHETHER the unmount-blur sends; it may never decide WHAT it
  // sends. A `was` written by half of the law would be a commit conditional
  // on the wrong snapshot — or on none, which is the resurrect-shaped silent
  // write this whole lane exists to refuse.
  const stage = { key: "stage", value: "review" }
  const enterFirst = editor()
  enterFirst.open(stage)
  enterFirst.enter()
  enterFirst.blur()
  expect(enterFirst.sent).toEqual(["enter's write"])
  expect(enterFirst.carried).toEqual([stage])

  const blurFirst = editor()
  blurFirst.open(stage)
  blurFirst.blur()
  expect(blurFirst.sent).toEqual(["the blur's write"])
  expect(blurFirst.carried).toEqual([stage])

  // ...and a REOPEN mints the next open's snapshot, exactly as it mints the
  // next open's record — the remount is the law, twice.
  const twice = editor()
  twice.open(stage)
  twice.enter()
  twice.blur()
  twice.open({ key: "stage", value: "addressing" })
  twice.blur()
  expect(twice.carried).toEqual([stage, { key: "stage", value: "addressing" }])
})

// ── which chip the editor is open on ───────────────────────────────────

const custom = (key: string) => ({ key, system: false })
const system = (key: string) => ({ key, system: true })
const EDITING = { key: "date", value: "in review" }

test("the editor is open on the chip it was opened from", () => {
  expect(openedOn(EDITING, custom("date"))).toEqual(EDITING)
  expect(openedOn(EDITING, custom("agent"))).toBeUndefined()
  expect(openedOn(undefined, custom("date"))).toBeUndefined()
  expect(openedOn(null, custom("date"))).toBeUndefined()
})

/**
 * THE COLLISION, which a bare-key comparison lost.
 *
 * `custom` is open all the way, so a hand-written record may carry a custom
 * `date` beside the FIELD of that name. Both chips are drawn on a node's own
 * page, and asked by bare key the editor opened on both — a writable box inside
 * a chip the drawer calls read-only, and two `data-key="date"` boxes on one
 * page (pi, S2).
 */
test("a SYSTEM chip is never the one, however its key is spelled", () => {
  expect(openedOn(EDITING, system("date"))).toBeUndefined()
  expect(openedOn(EDITING, system("id"))).toBeUndefined()
  // ...and the custom chip of the very same name still is, so the fix narrows
  // rather than breaks.
  expect(openedOn(EDITING, custom("date"))).toEqual(EDITING)
})
