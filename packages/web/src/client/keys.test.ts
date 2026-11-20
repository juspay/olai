import { expect, test } from "bun:test"

import {
  CHORDS,
  type EditAction,
  editKey,
  isApplePlatform,
  type ListAction,
  listKey,
  matchChord,
  matchKey,
  paneKey,
  selectKey,
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
  expect(matchKey(key("j", { meta: true }), "MacIntel")).toBeNull()
  expect(matchKey(key("\\", { meta: true }), "MacIntel")?.action).toBe("sidebar")
})

test("elsewhere, Ctrl bindings fire and bare Meta does not", () => {
  expect(matchKey(key("k", { ctrl: true }), "Linux x86_64")?.action).toBe(
    "palette",
  )
  expect(matchKey(key("k", { meta: true }), "Linux x86_64")).toBeNull()
  expect(matchKey(key("j", { ctrl: true }), "Linux x86_64")).toBeNull()
})

test("shifted and bare keys are ignored", () => {
  expect(matchKey(key("k"), "Linux x86_64")).toBeNull()
  expect(matchKey(key("k", { ctrl: true, shift: true }), "Linux x86_64")).toBeNull()
})

test("undo and redo are one key and a modifier, matched exactly", () => {
  expect(matchKey(key("z", { meta: true }), "MacIntel")?.action).toBe("undo")
  expect(matchKey(key("z", { meta: true, shift: true }), "MacIntel")?.action).toBe("redo")
  expect(matchKey(key("z", { ctrl: true }), "Linux x86_64")?.action).toBe("undo")
  expect(matchKey(key("Z", { ctrl: true, shift: true }), "Linux x86_64")?.action)
    .toBe("redo")
})

test("neither undo nor redo may fire with the caret in a field", () => {
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
  expect(editKey(key("Enter", { ctrl: true, shift: true }), "line")).toBe("walk")
  expect(editKey(key("Enter", { meta: true, shift: true }), "line")).toBe("walk")
})

test("calling a row off is the third member of the Enter family", () => {
  expect(editKey(key("Enter", { alt: true }), "line")).toBe("cancel-mark")
  expect(editKey(key("Enter", { alt: true, shift: true }), "line")).toBeNull()
  expect(editKey(key("Enter", { ctrl: true, alt: true }), "line")).toBe("toggle")
})

test("no mark key is a note's, the fourth mark's included", () => {
  expect(editKey(key("Enter", { alt: true }), "block")).toBeNull()
})

test("the walk does not eat the note's key, and the note does not eat the walk", () => {
  expect(editKey(key("Enter", { shift: true }), "line")).toBe("note")
  expect(editKey(key("Enter", { ctrl: true, shift: true }), "line")).not.toBe("note")
})

test("neither mark key is a note's", () => {
  expect(editKey(key("Enter", { ctrl: true }), "block")).toBeNull()
  expect(editKey(key("Enter", { ctrl: true, shift: true }), "block")).toBeNull()
})

test("the duplicate is the shifted D chord, on either platform", () => {
  expect(editKey(key("d", { ctrl: true, shift: true }), "line")).toBe("duplicate")
  expect(editKey(key("D", { meta: true, shift: true }), "line")).toBe("duplicate")
})

test("bare ⌘D stays the browser's bookmark key, and Alt does not stand in for Shift", () => {
  expect(editKey(key("d", { ctrl: true }), "line")).toBeNull()
  expect(editKey(key("d", { meta: true }), "line")).toBeNull()
  expect(editKey(key("d", { ctrl: true, shift: true, alt: true }), "line")).toBeNull()
  expect(editKey(key("d", { shift: true }), "line")).toBeNull()
})

test("the duplicate is dead in a note, like the mark keys", () => {
  expect(editKey(key("d", { ctrl: true, shift: true }), "block")).toBeNull()
})

test("a pick has no duplicate: bulk verbs are buttons in this app, not chords", () => {
  expect(selectKey(key("d", { ctrl: true, shift: true }))).toBeNull()
})

test("the bare arrows move between rows; a Ctrl+arrow on a Mac is the OS's", () => {
  expect(editKey(key("ArrowUp"), "line")).toBe("prev")
  expect(editKey(key("ArrowDown"), "line")).toBe("next")
  expect(editKey(key("ArrowDown", { ctrl: true }), "line", undefined, "MacIntel")).toBeNull()
  expect(editKey(key("ArrowUp", { ctrl: true }), "line", undefined, "MacIntel")).toBeNull()
})

test("one arrow, three readings, told apart by what is held", () => {
  expect(editKey(key("ArrowUp"), "line")).toBe("prev")
  expect(editKey(key("ArrowUp", { shift: true }), "line")).toBe("selectUp")
  expect(editKey(key("ArrowDown", { shift: true }), "line")).toBe("selectDown")
  expect(editKey(key("ArrowUp", { alt: true, shift: true }), "line")).toBe("up")
})

test("the move's second spelling is ⌘⇧, and it is Apple's alone", () => {
  expect(editKey(key("ArrowUp", { meta: true, shift: true }), "line", undefined, "MacIntel")).toBe("up")
  expect(editKey(key("ArrowDown", { meta: true, shift: true }), "line", undefined, "MacIntel")).toBe("down")
  expect(selectKey(key("ArrowUp", { meta: true, shift: true }), "MacIntel")).toBe("up")
  expect(selectKey(key("ArrowDown", { meta: true, shift: true }), "MacIntel")).toBe("down")
  expect(editKey(key("ArrowUp", { meta: true, shift: true }), "line", undefined, "Linux x86_64")).toBeNull()
  expect(selectKey(key("ArrowUp", { meta: true, shift: true }), "Linux x86_64")).toBeNull()
  expect(editKey(key("ArrowUp", { alt: true, shift: true }), "line", undefined, "MacIntel")).toBe("up")
  expect(selectKey(key("ArrowUp", { alt: true, shift: true }), "MacIntel")).toBe("up")
})

test("the zoom pair is Alt on one side of the OS line and ⌘ on the other", () => {
  expect(editKey(key(".", { alt: true }), "line", undefined, "Linux x86_64")).toBe("zoomIn")
  expect(editKey(key(",", { alt: true }), "line", undefined, "Linux x86_64")).toBe("zoomOut")
  expect(editKey(key(".", { meta: true }), "line", undefined, "MacIntel")).toBe("zoomIn")
  expect(editKey(key(",", { meta: true }), "line", undefined, "MacIntel")).toBe("zoomOut")
  expect(editKey(key(".", { meta: true }), "line", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key(",", { meta: true }), "line", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key(".", { alt: true }), "line", undefined, "MacIntel")).toBeNull()
  expect(editKey(key(",", { alt: true }), "line", undefined, "MacIntel")).toBeNull()
})

test("Ctrl+Space folds, on both platforms, with no other modifier", () => {
  for (const platform of ["MacIntel", "Linux x86_64"]) {
    expect(editKey(key(" ", { ctrl: true }), "line", undefined, platform)).toBe("fold")
    expect(editKey(key(" ", { ctrl: true, shift: true }), "line", undefined, platform)).toBeNull()
    expect(editKey(key(" ", { ctrl: true, meta: true }), "line", undefined, platform)).toBeNull()
  }
  expect(editKey(key(" "), "line")).toBeNull()
})

test("the fold arrows are Ctrl up and down on one side, ⌘ on the other", () => {
  expect(editKey(key("ArrowUp", { ctrl: true }), "line", undefined, "Linux x86_64")).toBe("collapse")
  expect(editKey(key("ArrowDown", { ctrl: true }), "line", undefined, "Linux x86_64")).toBe("expand")
  expect(editKey(key("ArrowUp", { meta: true }), "line", undefined, "MacIntel")).toBe("collapse")
  expect(editKey(key("ArrowDown", { meta: true }), "line", undefined, "MacIntel")).toBe("expand")
  expect(editKey(key("ArrowUp", { ctrl: true }), "line", undefined, "MacIntel")).toBeNull()
  expect(editKey(key("ArrowDown", { meta: true }), "line", undefined, "Linux x86_64")).toBeNull()
})

test("the zoom and fold keys are nobody's in a note", () => {
  expect(editKey(key(".", { alt: true }), "block", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key(" ", { ctrl: true }), "block", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key("ArrowUp", { ctrl: true }), "block", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key("ArrowDown", { meta: true, shift: true }), "block", undefined, "MacIntel")).toBeNull()
})

test("a note keeps Enter and the arrows for itself", () => {
  expect(editKey(key("Enter"), "block")).toBeNull()
  expect(editKey(key("ArrowUp"), "block")).toBeNull()
  expect(editKey(key("Tab"), "block")).toBeNull()
  expect(editKey(key("Enter", { shift: true }), "block")).toBe("note")
  expect(editKey(key("Escape"), "block")).toBe("cancel")
})

const at = (start: number, text: string, end = start) => ({ start, end, text })

const LINE = "hello world"

test("the SECOND ⌘A is the row's; the first is the input's own", () => {
  const all = at(0, LINE, LINE.length)
  expect(editKey(key("a", { meta: true }), "line")).toBeNull()
  expect(editKey(key("a", { ctrl: true }), "line", at(4, LINE))).toBeNull()
  expect(editKey(key("a", { meta: true }), "line", all)).toBe("selectAll")
  expect(editKey(key("A", { ctrl: true }), "line", all)).toBe("selectAll")
  expect(editKey(key("a", { meta: true }), "line", at(0, "", 0))).toBeNull()
  expect(editKey(key("a", { meta: true }), "block", all)).toBeNull()
})

test("Enter splits only with text on BOTH sides of the caret", () => {
  expect(editKey(key("Enter"), "line", at(5, LINE))).toBe("split")
  expect(editKey(key("Enter"), "line", at(11, LINE))).toBe("add")
  expect(editKey(key("Enter"), "line", at(0, LINE))).toBe("insert")
  expect(editKey(key("Enter"), "line", at(0, ""))).toBe("add")
  expect(editKey(key("Enter"), "line")).toBe("add")
})

test("a half of nothing but whitespace is an `add`, not a split the ops layer refuses", () => {
  expect(editKey(key("Enter"), "line", at(2, "  hello"))).toBe("add")
  expect(editKey(key("Enter"), "line", at(5, "hello  "))).toBe("add")
  expect(editKey(key("Enter"), "line", at(4, "  hello"))).toBe("split")
})

test("a selection splits around what it covers, and one spanning an end does not", () => {
  expect(editKey(key("Enter"), "line", at(3, LINE, 6))).toBe("split")
  expect(editKey(key("Enter"), "line", at(0, LINE, 11))).toBe("add")
  expect(editKey(key("Enter"), "line", at(3, LINE, 11))).toBe("add")
})

test("the horizontal arrows cross at a line's edge and never mid-word", () => {
  expect(editKey(key("ArrowLeft"), "line", at(0, LINE))).toBe("left")
  expect(editKey(key("ArrowRight"), "line", at(LINE.length, LINE))).toBe("right")
  expect(editKey(key("ArrowLeft"), "line", at(5, LINE))).toBeNull()
  expect(editKey(key("ArrowRight"), "line", at(5, LINE))).toBeNull()
  expect(editKey(key("ArrowLeft"), "line", at(0, LINE, 4))).toBeNull()
  expect(editKey(key("ArrowRight"), "line", at(0, LINE, 4))).toBeNull()
  expect(editKey(key("ArrowLeft"), "line")).toBeNull()
  expect(editKey(key("ArrowRight"), "line")).toBeNull()
  expect(editKey(key("ArrowLeft", { alt: true }), "line", at(0, LINE))).toBeNull()
  expect(editKey(key("ArrowRight", { meta: true }), "line", at(LINE.length, LINE))).toBeNull()
  expect(editKey(key("ArrowLeft"), "block", at(0, LINE))).toBeNull()
})

test("Backspace merges at offset zero, with nothing selected, and nowhere else", () => {
  expect(editKey(key("Backspace"), "line", at(0, LINE))).toBe("merge")
  expect(editKey(key("Backspace"), "line", at(1, LINE))).toBeNull()
  expect(editKey(key("Backspace"), "line", at(0, LINE, 4))).toBeNull()
  expect(editKey(key("Backspace"), "line")).toBeNull()
  expect(editKey(key("Backspace", { alt: true }), "line", at(0, LINE))).toBeNull()
  expect(editKey(key("Backspace"), "block", at(0, LINE))).toBeNull()
})

test("no editing key is one of the reserved chords", () => {
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

test("the picked rows answer the same keys one row does", () => {
  expect(selectKey(key("Tab"))).toBe("in")
  expect(selectKey(key("Tab", { shift: true }))).toBe("out")
  expect(selectKey(key("ArrowUp", { alt: true, shift: true }))).toBe("up")
  expect(selectKey(key("ArrowDown", { alt: true, shift: true }))).toBe("down")
  expect(selectKey(key("Enter", { ctrl: true }))).toBe("complete")
  expect(selectKey(key("Enter", { meta: true }))).toBe("complete")
  expect(selectKey(key("Escape"))).toBe("clear")
})

test("...plus the three that are about the pick itself", () => {
  expect(selectKey(key("ArrowUp", { shift: true }))).toBe("growUp")
  expect(selectKey(key("ArrowDown", { shift: true }))).toBe("growDown")
  expect(selectKey(key("a", { meta: true }))).toBe("all")
})

test("no key of the selection layer is one of the reserved chords", () => {
  for (const platform of ["MacIntel", "Linux x86_64"]) {
    for (const chord of CHORDS) {
      for (const mods of [{ meta: true }, { ctrl: true }]) {
        const event = key(chord.key, { ...mods, shift: chord.shift === true })
        if (matchKey(event, platform) === null) continue
        expect(selectKey(event)).toBeNull()
      }
    }
  }
})

test("a bare letter is nobody's key", () => {
  expect(selectKey(key("a"))).toBeNull()
  expect(selectKey(key("Enter"))).toBeNull()
  expect(selectKey(key("ArrowDown"))).toBeNull()
})

test("every chord in the table is reachable", () => {
  for (const chord of CHORDS) {
    expect(
      matchKey(key(chord.key, { ctrl: true, shift: chord.shift === true }), "Linux x86_64")
        ?.action,
    ).toBe(chord.action)
  }
})

test("every editing key is written down for a person", () => {
  const said = new Set(
    SHORTCUTS.flatMap((group) => group.keys.flatMap((key) => key.action ?? [])),
  )
  const actions: ReadonlyArray<EditAction> = [
    "add",
    "insert",
    "split",
    "merge",
    "in",
    "out",
    "up",
    "down",
    "zoomIn",
    "zoomOut",
    "fold",
    "collapse",
    "expand",
    "toggle",
    "cancel-mark",
    "walk",
    "note",
    "prev",
    "next",
    "left",
    "right",
    "cancel",
    "selectUp",
    "selectDown",
    "selectAll",
  ]
  const pairs: Partial<Record<EditAction, EditAction>> = {
    next: "prev",
    right: "left",
    selectDown: "selectUp",
  }
  const covered = actions.filter((action) => {
    const twin = pairs[action]
    return said.has(action) || (twin !== undefined && said.has(twin))
  })
  expect(covered).toEqual([...actions])
})

test("the reference names the same chords the matcher answers", () => {
  const anywhere = SHORTCUTS.find((group) => group.group === "Anywhere")
  expect(anywhere?.keys.length).toBe(CHORDS.length)
})

test("⌘J is neither a chord nor a line in the reference", () => {
  expect(CHORDS.some((chord) => chord.key === "j")).toBe(false)
  const lines = SHORTCUTS.flatMap((group) => group.keys.map((key) => key.keys))
  expect(lines.some((keys) => keys.includes("⌘J") || keys.includes("Ctrl+J"))).toBe(false)
})

test("Alt+Left and Alt+Right move pane focus, and Shift keeps them the row's", () => {
  expect(paneKey(key("ArrowLeft", { alt: true }), false)).toBe("focusLeft")
  expect(paneKey(key("ArrowRight", { alt: true }), false)).toBe("focusRight")
  expect(paneKey(key("ArrowLeft", { alt: true, shift: true }), false)).toBeNull()
  expect(paneKey(key("ArrowLeft"), false)).toBeNull()
})

test("Alt+Left and Alt+Right are the text field's while typing", () => {
  expect(paneKey(key("ArrowLeft", { alt: true }), true)).toBeNull()
  expect(paneKey(key("ArrowRight", { alt: true }), true)).toBeNull()
})

test("a list takes the four keys it has answers for", () => {
  expect(listKey(key("ArrowDown"))).toBe("next")
  expect(listKey(key("ArrowUp"))).toBe("prev")
  expect(listKey(key("Enter"))).toBe("take")
  expect(listKey(key("Escape"))).toBe("dismiss")
})

test("everything else goes straight through to the surface under it", () => {
  for (const other of ["Tab", "Backspace", "a", "Home", "ArrowLeft"]) {
    expect(listKey(key(other))).toBeNull()
  }
})

test("a modified Enter is never the list's", () => {
  expect(listKey(key("Enter", { ctrl: true }))).toBeNull()
  expect(listKey(key("Enter", { meta: true }))).toBeNull()
  expect(listKey(key("Enter", { shift: true }))).toBeNull()
  expect(listKey(key("Enter", { alt: true }))).toBeNull()
  expect(listKey(key("ArrowDown", { alt: true, shift: true }))).toBeNull()
})

test("Escape dismisses whatever else is held", () => {
  expect(listKey(key("Escape", { shift: true }))).toBe("dismiss")
})

test("every list key is written down for a person too", () => {
  const said = new Set(
    SHORTCUTS.flatMap((group) => group.keys.flatMap((key) => key.list ?? [])),
  )
  const actions: ReadonlyArray<ListAction> = ["next", "prev", "take", "dismiss"]
  expect(actions.filter((action) => said.has(action))).toEqual([...actions])
})

test("Tab belongs to a listing box only when that caller opts in", () => {
  const event = { key: "Tab", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false } as KeyboardEvent
  expect(listKey(event)).toBeNull()
  expect(listKey(event, true)).toBe("cycle")
})

test("a registered chord is matched by the core table's rule, Shift exactly and the key a hand reaches for", () => {
  const table = [{ key: ".", shift: true, id: "next" }, { key: "x", shift: true, id: "close" }]
  const shifted = (k: string, code: string, mods: Parameters<typeof key>[1]) => ({ ...key(k, mods), code }) as KeyboardEvent
  expect(matchChord(shifted(">", "Period", { ctrl: true, shift: true }), table, "Linux x86_64")?.id).toBe("next")
  expect(matchChord(shifted(">", "Period", { meta: true, shift: true }), table, "MacIntel")?.id).toBe("next")
  expect(matchChord(shifted(".", "Period", { ctrl: true }), table, "Linux x86_64")).toBeNull()
  expect(matchChord(shifted("X", "KeyX", { ctrl: true, shift: true }), table, "Linux x86_64")?.id).toBe("close")
  expect(matchChord(shifted("X", "KeyX", { ctrl: true, shift: true, alt: true }), table, "Linux x86_64")).toBeNull()
  expect(matchChord(shifted("X", "KeyX", { meta: true, shift: true }), table, "Linux x86_64")).toBeNull()
})
