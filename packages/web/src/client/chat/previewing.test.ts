/**
 * WHICH AGENT'S WORK IS OPEN, and the one way that answer can be wrong.
 *
 * The signal itself is three lines and would not be worth a table. What is
 * worth one is the LIFETIME, because it is the half that was documented and not
 * wired: the module claimed the open shelf is cleared when the conversation
 * changes, and nothing cleared it (both reviewers of #412, independently).
 *
 * The failure it hides behind is why it survived a read. A shelf whose key
 * names a row this conversation does not have draws nothing — `Preview.of()`
 * guards a MISSING row — so within one server lifetime a stale key is invisible.
 * What it cannot guard is a key that COLLIDES: a fresh transcript counts from
 * `tool:1`, so after a restart without a reload the key left over from the last
 * conversation can name somebody else's third tool call, and a shelf nobody
 * pressed opens on it with the pressed state lit on a door nobody touched.
 *
 * So what is pinned here is that closing is reachable and total, and the wiring
 * that calls it on a session change is asserted where the session is known
 * (`./state.ts`).
 */

import { expect, test } from "bun:test"

import { closePreview, isPreviewing, previewing, togglePreview } from "./previewing.ts"

test("nothing is open until a door is pressed", () => {
  closePreview()
  expect(previewing()).toBeNull()
  expect(isPreviewing("tool:agent-1")).toBe(false)
})

test("one at a time — opening an agent puts the last one away", () => {
  // Five agents out is five doors and one shelf, on purpose: stacked shelves
  // would be the transcript's own problem moved up the panel.
  closePreview()
  togglePreview("tool:agent-1")
  expect(previewing()).toBe("tool:agent-1")
  togglePreview("tool:agent-2")
  expect(previewing()).toBe("tool:agent-2")
  expect(isPreviewing("tool:agent-1")).toBe(false)
})

test("the door is the same control both ways round", () => {
  // A reader who presses the agent they are already reading means *put it
  // away*, which is why the strip entry and the row's door are one gesture
  // rather than an open and a separate close.
  closePreview()
  togglePreview("tool:agent-1")
  togglePreview("tool:agent-1")
  expect(previewing()).toBeNull()
})

test("and it can be closed by something that is not a door", () => {
  // The shelf's own dismiss, and the conversation changing under it — which is
  // the caller this existed for and did not have. A key from a conversation
  // that is gone is not merely stale: the next one re-mints keys from the same
  // counter, so it can name a row nobody opened.
  closePreview()
  togglePreview("tool:agent-1")
  closePreview()
  expect(previewing()).toBeNull()
})
