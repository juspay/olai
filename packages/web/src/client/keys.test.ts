import { expect, test } from "bun:test"

import {
  CHORDS,
  type EditAction,
  editKey,
  isApplePlatform,
  matchKey,
  SHORTCUTS,
} from "./keys.ts"

const key = (
  k: string,
  mods: { meta?: boolean; ctrl?: boolean; alt?: boolean; shift?: boolean } = {},
): KeyboardEvent =>
  ({
    key: k,
    metaKey: mods.meta === true,
    ctrlKey: mods.ctrl === true,
    altKey: mods.alt === true,
    shiftKey: mods.shift === true,
  }) as KeyboardEvent

test("on Apple, Meta bindings fire and bare Ctrl does not", () => {
  expect(matchKey(key("k", { meta: true }), "MacIntel")?.action).toBe("palette")
  expect(matchKey(key("k", { ctrl: true }), "MacIntel")).toBeNull()
  expect(matchKey(key("j", { meta: true }), "MacIntel")?.action).toBe("chat")
  expect(matchKey(key("\\", { meta: true }), "MacIntel")?.action).toBe("sidebar")
})

test("elsewhere, Ctrl bindings fire and bare Meta does not", () => {
  expect(matchKey(key("k", { ctrl: true }), "Linux x86_64")?.action).toBe(
    "palette",
  )
  expect(matchKey(key("k", { meta: true }), "Linux x86_64")).toBeNull()
  expect(matchKey(key("j", { ctrl: true }), "Linux x86_64")?.action).toBe("chat")
})

test("shifted and bare keys are ignored", () => {
  expect(matchKey(key("k"), "Linux x86_64")).toBeNull()
  expect(matchKey(key("k", { ctrl: true, shift: true }), "Linux x86_64")).toBeNull()
})

test("undo and redo are one key and a modifier, matched exactly", () => {
  // The pair a person's hands already know. Shift tells them apart rather than
  // a second letter, so the two are two rows of one table — and the unshifted
  // chord must be dead with shift held, or ⌘⇧Z would undo twice.
  expect(matchKey(key("z", { meta: true }), "MacIntel")?.action).toBe("undo")
  expect(matchKey(key("z", { meta: true, shift: true }), "MacIntel")?.action).toBe("redo")
  expect(matchKey(key("z", { ctrl: true }), "Linux x86_64")?.action).toBe("undo")
  // Browsers deliver the shifted letter in upper case, which is what a person
  // pressing ⌘⇧Z actually sends.
  expect(matchKey(key("Z", { ctrl: true, shift: true }), "Linux x86_64")?.action)
    .toBe("redo")
})

test("neither undo nor redo may fire with the caret in a field", () => {
  // A draft has the platform's own undo in it, and Escape owns abandoning one
  // — so the stack of structural ops is dead while somebody is typing.
  for (const chord of CHORDS) {
    if (chord.action === "undo" || chord.action === "redo") {
      expect(chord.whileEditing).toBe(false)
    }
  }
})

test("isApplePlatform recognises Mac and iOS", () => {
  expect(isApplePlatform("MacIntel")).toBe(true)
  expect(isApplePlatform("iPhone")).toBe(true)
  expect(isApplePlatform("Linux x86_64")).toBe(false)
})

// ── the row layer ──────────────────────────────────────────────────────

test("a title's keys are the Workflowy set", () => {
  expect(editKey(key("Enter"), "line")).toBe("add")
  expect(editKey(key("Tab"), "line")).toBe("in")
  expect(editKey(key("Tab", { shift: true }), "line")).toBe("out")
  expect(editKey(key("ArrowUp", { alt: true, shift: true }), "line")).toBe("up")
  expect(editKey(key("ArrowDown", { alt: true, shift: true }), "line")).toBe(
    "down",
  )
  expect(editKey(key("Enter", { shift: true }), "line")).toBe("note")
  expect(editKey(key("Escape"), "line")).toBe("cancel")
})

test("toggling the mark answers to either platform's Enter chord", () => {
  expect(editKey(key("Enter", { ctrl: true }), "line")).toBe("toggle")
  expect(editKey(key("Enter", { meta: true }), "line")).toBe("toggle")
})

test("the bare arrows move between rows; modified ones do not", () => {
  expect(editKey(key("ArrowUp"), "line")).toBe("prev")
  expect(editKey(key("ArrowDown"), "line")).toBe("next")
  expect(editKey(key("ArrowDown", { shift: true }), "line")).toBeNull()
  expect(editKey(key("ArrowDown", { ctrl: true }), "line")).toBeNull()
})

test("a note keeps Enter and the arrows for itself", () => {
  // The whole difference between the two fields: prose needs newlines and a
  // caret that can go up, so only the two keys that LEAVE the note are read.
  expect(editKey(key("Enter"), "block")).toBeNull()
  expect(editKey(key("ArrowUp"), "block")).toBeNull()
  expect(editKey(key("Tab"), "block")).toBeNull()
  expect(editKey(key("Enter", { shift: true }), "block")).toBe("note")
  expect(editKey(key("Escape"), "block")).toBe("cancel")
})

test("no editing key is one of the reserved chords", () => {
  // The collision this file exists to make impossible: every chord the global
  // layer claims must be dead to the row layer, on both platforms. Over the
  // TABLE rather than a list spelled here — a fourth chord is covered by being
  // declared, which is the only way this check stays true.
  for (const platform of ["MacIntel", "Linux x86_64"]) {
    for (const chord of CHORDS) {
      for (const mods of [{ meta: true }, { ctrl: true }]) {
        const event = key(chord.key, { ...mods, shift: chord.shift === true })
        if (matchKey(event, platform) === null) continue
        expect(editKey(event, "line")).toBeNull()
        expect(editKey(event, "block")).toBeNull()
      }
    }
  }
})

test("every chord in the table is reachable", () => {
  // The other half: a row in the table that `matchKey` cannot produce would
  // make the check above pass by never running.
  for (const chord of CHORDS) {
    expect(
      matchKey(key(chord.key, { ctrl: true, shift: chord.shift === true }), "Linux x86_64")
        ?.action,
    ).toBe(chord.action)
  }
})

// ── what a person is told ──────────────────────────────────────────────

test("every editing key is written down for a person", () => {
  // The reference the palette draws is beside the matcher it describes, and
  // this is what keeps it that way: a key added to the map without a sentence
  // fails here rather than shipping undocumented.
  const said = new Set(
    SHORTCUTS.flatMap((group) => group.keys.flatMap((key) => key.action ?? [])),
  )
  const actions: ReadonlyArray<EditAction> = [
    "add",
    "in",
    "out",
    "up",
    "down",
    "toggle",
    "note",
    "prev",
    "next",
    "cancel",
  ]
  // `next` shares its line with `prev` (one row about the arrows), so it is
  // the pair that has to be covered rather than each name.
  const covered = actions.filter((action) =>
    said.has(action) || (action === "next" && said.has("prev"))
  )
  expect(covered).toEqual([...actions])
})

test("the reference names the same chords the matcher answers", () => {
  const anywhere = SHORTCUTS.find((group) => group.group === "Anywhere")
  expect(anywhere?.keys.length).toBe(CHORDS.length)
})
