import { expect, test } from "bun:test"

import { preferenceChanged } from "./preference.ts"

const KEY = "olai.theme"

/** What a browser hands a `storage` listener, as much of it as this decision
 *  reads. A literal rather than a real `StorageEvent`, because the two fields
 *  below ARE the input — a constructed event would be the same two fields with
 *  a ceremony in front of them, and the runner has no `StorageEvent` anyway. */
const said = (key: string | null, newValue: string | null): StorageEvent =>
  ({ key, newValue }) as StorageEvent

test("another tab's pick under this key is the new value", () => {
  expect(preferenceChanged(said(KEY, "pitch"), KEY)).toBe("pitch")
})

test("another tab forgetting it is null, which is a value and not a silence", () => {
  expect(preferenceChanged(said(KEY, null), KEY)).toBeNull()
})

// The case that is easy to miss, and it is not hypothetical: `localStorage
// .clear()` fires ONE event naming no key, and every preference this browser
// held is gone. Read as "not about me", it would leave the tab that cleared
// nothing and every sibling tab still painted in a theme that is no longer
// stored anywhere.
test("a cleared storage names no key, and clears this one too", () => {
  expect(preferenceChanged(said(null, null), KEY)).toBeNull()
})

test("somebody else's key is not this preference", () => {
  expect(preferenceChanged(said("olai.chat.open", "true"), KEY)).toBeUndefined()
  expect(preferenceChanged(said("theme", "pitch"), KEY)).toBeUndefined()
})
