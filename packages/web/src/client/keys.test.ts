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

test("the mark walk is the same chord with shift, on either platform", () => {
  // The two mark keys are one modifier apart, which is the grammar: `Enter` is
  // the row's key, and what is held says which kind of change it is.
  expect(editKey(key("Enter", { ctrl: true, shift: true }), "line")).toBe("walk")
  expect(editKey(key("Enter", { meta: true, shift: true }), "line")).toBe("walk")
})

test("the walk does not eat the note's key, and the note does not eat the walk", () => {
  // The regression this ordering exists for: `Shift+Enter` is the note and
  // `Ctrl+Shift+Enter` is the walk, so the note's branch has to name the two
  // modifiers it must not see — otherwise the more specific chord is swallowed
  // by the more general one and the mark key opens a textarea.
  expect(editKey(key("Enter", { shift: true }), "line")).toBe("note")
  expect(editKey(key("Enter", { ctrl: true, shift: true }), "line")).not.toBe("note")
})

test("neither mark key is a note's", () => {
  // A note is prose; the keys that edit a ROW are the row's. `Ctrl+Enter` has
  // always been dead in one, and the walk is dead there for the same reason
  // rather than by omission.
  expect(editKey(key("Enter", { ctrl: true }), "block")).toBeNull()
  expect(editKey(key("Enter", { ctrl: true, shift: true }), "block")).toBeNull()
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

// ── the two the caret decides ──────────────────────────────────────────

/** Where the caret is in a line of `length`, as the matcher takes it. */
const at = (start: number, length: number, end = start) => ({ start, end, length })

test("Enter splits only with text on BOTH sides of the caret", () => {
  expect(editKey(key("Enter"), "line", at(5, 11))).toBe("split")
  // At the END of the line it is the key it has always been.
  expect(editKey(key("Enter"), "line", at(11, 11))).toBe("add")
  // At the HEAD of it too: the head would be empty, which is not a node this
  // format can hold, so there is no blank row to insert above.
  expect(editKey(key("Enter"), "line", at(0, 11))).toBe("add")
  // A caller that cannot say where the caret is gets the old reading, which is
  // the safe way round.
  expect(editKey(key("Enter"), "line")).toBe("add")
})

test("a selection splits around what it covers, and one spanning an end does not", () => {
  // What a split KEEPS is what falls outside the selection, so the same test
  // reads it: text before `start`, text after `end`.
  expect(editKey(key("Enter"), "line", at(3, 11, 6))).toBe("split")
  expect(editKey(key("Enter"), "line", at(0, 11, 11))).toBe("add")
  expect(editKey(key("Enter"), "line", at(3, 11, 11))).toBe("add")
})

test("Backspace merges at offset zero, with nothing selected, and nowhere else", () => {
  expect(editKey(key("Backspace"), "line", at(0, 11))).toBe("merge")
  // Anywhere else it is the field's own — there is a character to delete.
  expect(editKey(key("Backspace"), "line", at(1, 11))).toBeNull()
  // A selection that starts at zero is a deletion, not a merge.
  expect(editKey(key("Backspace"), "line", at(0, 11, 4))).toBeNull()
  expect(editKey(key("Backspace"), "line")).toBeNull()
  // Modified Backspace is the platform's (delete-word), and a NOTE is prose:
  // the row's keys are the row's.
  expect(editKey(key("Backspace", { alt: true }), "line", at(0, 11))).toBeNull()
  expect(editKey(key("Backspace"), "block", at(0, 11))).toBeNull()
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
    "split",
    "merge",
    "in",
    "out",
    "up",
    "down",
    "toggle",
    "walk",
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
