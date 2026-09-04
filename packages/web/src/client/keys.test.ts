import { expect, test } from "bun:test"

import {
  CHORDS,
  type EditAction,
  editKey,
  isApplePlatform,
  type ListAction,
  listKey,
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
  expect(matchKey(key("j", { meta: true }), "MacIntel")?.action).toBe("panel")
  expect(matchKey(key("\\", { meta: true }), "MacIntel")?.action).toBe("sidebar")
})

test("elsewhere, Ctrl bindings fire and bare Meta does not", () => {
  expect(matchKey(key("k", { ctrl: true }), "Linux x86_64")?.action).toBe(
    "palette",
  )
  expect(matchKey(key("k", { meta: true }), "Linux x86_64")).toBeNull()
  expect(matchKey(key("j", { ctrl: true }), "Linux x86_64")?.action).toBe("panel")
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

test("calling a row off is the third member of the Enter family", () => {
  // ALT alone, on either platform's naming: `Ctrl` finishes, `Ctrl+Shift`
  // walks, `Alt` cancels. It used to be `null` here, which is why there was a
  // modifier left to give the fourth mark.
  expect(editKey(key("Enter", { alt: true }), "line")).toBe("cancel-mark")
  // And it is exactly ALT WITHOUT SHIFT. `Alt+Shift` is the MOVE pair on the
  // arrows, so the chord that means "move this row" two keys over stays
  // unclaimed here rather than quietly meaning "call it off".
  expect(editKey(key("Enter", { alt: true, shift: true }), "line")).toBeNull()
  // A modifier that already claims the key wins, as it does for the walk.
  expect(editKey(key("Enter", { ctrl: true, alt: true }), "line")).toBe("toggle")
})

test("no mark key is a note's, the fourth mark's included", () => {
  // A note is prose; the keys that edit a ROW are the row's. All three are dead
  // in one, and the third is dead there by the same branch rather than by
  // omission — `field === "block"` returns before any of them is read.
  expect(editKey(key("Enter", { alt: true }), "block")).toBeNull()
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

test("the duplicate is the shifted D chord, on either platform", () => {
  expect(editKey(key("d", { ctrl: true, shift: true }), "line")).toBe("duplicate")
  expect(editKey(key("D", { meta: true, shift: true }), "line")).toBe("duplicate")
})

test("bare ⌘D stays the browser's bookmark key, and Alt does not stand in for Shift", () => {
  // The SHIFT is required rather than tolerated. Stealing ⌘D inside a text
  // field would take a chord every browser has trained every reader on, for a
  // verb that is also two clicks away in the row's menu.
  expect(editKey(key("d", { ctrl: true }), "line")).toBeNull()
  expect(editKey(key("d", { meta: true }), "line")).toBeNull()
  expect(editKey(key("d", { ctrl: true, shift: true, alt: true }), "line")).toBeNull()
  expect(editKey(key("d", { shift: true }), "line")).toBeNull()
})

test("the duplicate is dead in a note, like the mark keys", () => {
  // A note is prose, and the keys that edit a ROW are the row's.
  expect(editKey(key("d", { ctrl: true, shift: true }), "block")).toBeNull()
})

test("a pick has no duplicate: bulk verbs are buttons in this app, not chords", () => {
  // The selection layer answers every other row key and deliberately not this
  // one — the same ruling that keeps the put-away off the keyboard while rows
  // are picked (`./keys.ts`).
  expect(selectKey(key("d", { ctrl: true, shift: true }))).toBeNull()
})

test("the bare arrows move between rows; a Ctrl+arrow on a Mac is the OS's", () => {
  expect(editKey(key("ArrowUp"), "line")).toBe("prev")
  expect(editKey(key("ArrowDown"), "line")).toBe("next")
  // Pinned to Apple, where Mission Control owns the chord and the fold pair
  // lives on ⌘ instead: it must stay nobody's rather than quietly working on
  // the one platform where the keypress never arrives.
  expect(editKey(key("ArrowDown", { ctrl: true }), "line", undefined, "MacIntel")).toBeNull()
  expect(editKey(key("ArrowUp", { ctrl: true }), "line", undefined, "MacIntel")).toBeNull()
})

test("one arrow, three readings, told apart by what is held", () => {
  // The whole grammar of the row layer in one key: bare is the caret, Shift
  // leaves it and picks rows, Alt+Shift moves the row itself.
  expect(editKey(key("ArrowUp"), "line")).toBe("prev")
  expect(editKey(key("ArrowUp", { shift: true }), "line")).toBe("selectUp")
  expect(editKey(key("ArrowDown", { shift: true }), "line")).toBe("selectDown")
  expect(editKey(key("ArrowUp", { alt: true, shift: true }), "line")).toBe("up")
})

test("the move's second spelling is ⌘⇧, and it is Apple's alone", () => {
  // What Workflowy's own table gives a Mac reader; a Windows browser never
  // hears bare Meta, so there is nothing to answer there.
  expect(editKey(key("ArrowUp", { meta: true, shift: true }), "line", undefined, "MacIntel")).toBe("up")
  expect(editKey(key("ArrowDown", { meta: true, shift: true }), "line", undefined, "MacIntel")).toBe("down")
  expect(selectKey(key("ArrowUp", { meta: true, shift: true }), "MacIntel")).toBe("up")
  expect(selectKey(key("ArrowDown", { meta: true, shift: true }), "MacIntel")).toBe("down")
  expect(editKey(key("ArrowUp", { meta: true, shift: true }), "line", undefined, "Linux x86_64")).toBeNull()
  expect(selectKey(key("ArrowUp", { meta: true, shift: true }), "Linux x86_64")).toBeNull()
  // Alt+Shift goes on working on both — it is the spelling this app has
  // always had, and nothing here takes a chord away.
  expect(editKey(key("ArrowUp", { alt: true, shift: true }), "line", undefined, "MacIntel")).toBe("up")
  expect(selectKey(key("ArrowUp", { alt: true, shift: true }), "MacIntel")).toBe("up")
})

test("the zoom pair is Alt on one side of the OS line and ⌘ on the other", () => {
  // The split is the platform's own doing: on a Mac ⌥ is the text modifier —
  // ⌥. types ≥ — so the chord a Workflowy hand reaches for there is ⌘.
  expect(editKey(key(".", { alt: true }), "line", undefined, "Linux x86_64")).toBe("zoomIn")
  expect(editKey(key(",", { alt: true }), "line", undefined, "Linux x86_64")).toBe("zoomOut")
  expect(editKey(key(".", { meta: true }), "line", undefined, "MacIntel")).toBe("zoomIn")
  expect(editKey(key(",", { meta: true }), "line", undefined, "MacIntel")).toBe("zoomOut")
  // ...and each platform's other spelling is nobody's: not claimed by the
  // row, free to stay the OS's or the character's.
  expect(editKey(key(".", { meta: true }), "line", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key(",", { meta: true }), "line", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key(".", { alt: true }), "line", undefined, "MacIntel")).toBeNull()
  expect(editKey(key(",", { alt: true }), "line", undefined, "MacIntel")).toBeNull()
})

test("Ctrl+Space folds, on both platforms, with no other modifier", () => {
  for (const platform of ["MacIntel", "Linux x86_64"]) {
    expect(editKey(key(" ", { ctrl: true }), "line", undefined, platform)).toBe("fold")
    // Shift or ⌘ on top is a different chord nobody has yet given a meaning —
    // unclaimed rather than read as the fold.
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
  // And the cross spellings stay dead — see the pinned test above for why.
  expect(editKey(key("ArrowUp", { ctrl: true }), "line", undefined, "MacIntel")).toBeNull()
  expect(editKey(key("ArrowDown", { meta: true }), "line", undefined, "Linux x86_64")).toBeNull()
})

test("the zoom and fold keys are nobody's in a note", () => {
  // A note is prose; the keys that edit a ROW are the row's — and a page
  // chord has no business reaching through one either.
  expect(editKey(key(".", { alt: true }), "block", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key(" ", { ctrl: true }), "block", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key("ArrowUp", { ctrl: true }), "block", undefined, "Linux x86_64")).toBeNull()
  expect(editKey(key("ArrowDown", { meta: true, shift: true }), "block", undefined, "MacIntel")).toBeNull()
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

// ── the three the caret decides ────────────────────────────────────────

/** The caret in a line the field holds, as the matcher takes it. */
const at = (start: number, text: string, end = start) => ({ start, end, text })

const LINE = "hello world"

test("the SECOND ⌘A is the row's; the first is the input's own", () => {
  // The same caret value the split and merge readings are asked of, asked a
  // third question — so "the whole line is already selected" is a fact about
  // the field rather than a flag beside one.
  const all = at(0, LINE, LINE.length)
  expect(editKey(key("a", { meta: true }), "line")).toBeNull()
  expect(editKey(key("a", { ctrl: true }), "line", at(4, LINE))).toBeNull()
  expect(editKey(key("a", { meta: true }), "line", all)).toBe("selectAll")
  expect(editKey(key("A", { ctrl: true }), "line", all)).toBe("selectAll")
  // An EMPTY field is not "wholly selected": ⌘A in a new row does nothing
  // rather than picking the row nobody has written yet.
  expect(editKey(key("a", { meta: true }), "line", at(0, "", 0))).toBeNull()
  // ...and never in a note, where ⌘A is the textarea's like every other key.
  expect(editKey(key("a", { meta: true }), "block", all)).toBeNull()
})

test("Enter splits only with text on BOTH sides of the caret", () => {
  expect(editKey(key("Enter"), "line", at(5, LINE))).toBe("split")
  // At the END of the line it is the key it has always been.
  expect(editKey(key("Enter"), "line", at(11, LINE))).toBe("add")
  // At the HEAD of a titled line: a local draft above, words stay.
  expect(editKey(key("Enter"), "line", at(0, LINE))).toBe("insert")
  // An empty field is `add` — start and end are the same place, and Enter on
  // an empty draft opens the next empty one rather than stacking above itself.
  expect(editKey(key("Enter"), "line", at(0, ""))).toBe("add")
  // A caller that cannot say where the caret is gets the old reading, which is
  // the safe way round.
  expect(editKey(key("Enter"), "line")).toBe("add")
})

test("a half of nothing but whitespace is an `add`, not a split the ops layer refuses", () => {
  // A node needs a TITLE, and a title of spaces is not one — so the decision
  // that a half this format cannot hold makes the key an `add` is spelled here
  // rather than met as a refusal under the row a moment later.
  expect(editKey(key("Enter"), "line", at(2, "  hello"))).toBe("add")
  expect(editKey(key("Enter"), "line", at(5, "hello  "))).toBe("add")
  // And the same line cut where both halves are real is still a split.
  expect(editKey(key("Enter"), "line", at(4, "  hello"))).toBe("split")
})

test("a selection splits around what it covers, and one spanning an end does not", () => {
  // What a split KEEPS is what falls outside the selection, so the same test
  // reads it: text before `start`, text after `end`.
  expect(editKey(key("Enter"), "line", at(3, LINE, 6))).toBe("split")
  expect(editKey(key("Enter"), "line", at(0, LINE, 11))).toBe("add")
  expect(editKey(key("Enter"), "line", at(3, LINE, 11))).toBe("add")
})

test("the horizontal arrows cross at a line's edge and never mid-word", () => {
  // `Backspace`'s boundary rule, one key over: an edge-press is the only one
  // this matcher claims — a caret walking through a word is the platform's
  // own movement, and no outliner's hands expect ← mid-word to take them to
  // another row.
  expect(editKey(key("ArrowLeft"), "line", at(0, LINE))).toBe("left")
  expect(editKey(key("ArrowRight"), "line", at(LINE.length, LINE))).toBe("right")
  expect(editKey(key("ArrowLeft"), "line", at(5, LINE))).toBeNull()
  expect(editKey(key("ArrowRight"), "line", at(5, LINE))).toBeNull()
  // A SELECTION sitting on the edge is not an edge press: ← collapses it and
  // → extends it, both the platform's.
  expect(editKey(key("ArrowLeft"), "line", at(0, LINE, 4))).toBeNull()
  expect(editKey(key("ArrowRight"), "line", at(0, LINE, 4))).toBeNull()
  // An absent caret is the safe side, as `split`'s is.
  expect(editKey(key("ArrowLeft"), "line")).toBeNull()
  expect(editKey(key("ArrowRight"), "line")).toBeNull()
  // A modifier makes it the platform's word-jump or the OS's — never the
  // row's; and a note is prose, the row's keys are the row's.
  expect(editKey(key("ArrowLeft", { alt: true }), "line", at(0, LINE))).toBeNull()
  expect(editKey(key("ArrowRight", { meta: true }), "line", at(LINE.length, LINE))).toBeNull()
  expect(editKey(key("ArrowLeft"), "block", at(0, LINE))).toBeNull()
})

test("Backspace merges at offset zero, with nothing selected, and nowhere else", () => {
  expect(editKey(key("Backspace"), "line", at(0, LINE))).toBe("merge")
  // Anywhere else it is the field's own — there is a character to delete.
  expect(editKey(key("Backspace"), "line", at(1, LINE))).toBeNull()
  // A selection that starts at zero is a deletion, not a merge.
  expect(editKey(key("Backspace"), "line", at(0, LINE, 4))).toBeNull()
  expect(editKey(key("Backspace"), "line")).toBeNull()
  // Modified Backspace is the platform's (delete-word), and a NOTE is prose:
  // the row's keys are the row's.
  expect(editKey(key("Backspace", { alt: true }), "line", at(0, LINE))).toBeNull()
  expect(editKey(key("Backspace"), "block", at(0, LINE))).toBeNull()
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

// ── the selection layer ────────────────────────────────────────────────

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
  // The same collision check the row layer gets, for the same reason and over
  // the same table: ⌘Z with rows picked has to reach the undo stack.
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
  // The pick is live over the whole page, so anything this claimed would be a
  // keystroke a reader could not get back.
  expect(selectKey(key("a"))).toBeNull()
  expect(selectKey(key("Enter"))).toBeNull()
  expect(selectKey(key("ArrowDown"))).toBeNull()
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
  // Two pairs share a line, because each pair is one row about one key: the
  // bare arrows, and the shifted ones. So it is the pair that has to be
  // covered rather than each name.
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

test("Alt+Left and Alt+Right move pane focus, and Shift keeps them the row's", () => {
  expect(paneKey(key("ArrowLeft", { alt: true }))).toBe("focusLeft")
  expect(paneKey(key("ArrowRight", { alt: true }))).toBe("focusRight")
  expect(paneKey(key("ArrowLeft", { alt: true, shift: true }))).toBeNull()
  expect(paneKey(key("ArrowLeft"))).toBeNull()
})

// ── the list layer ─────────────────────────────────────────────────────

// The keys a shortlist takes while one is up — the ⌘K palette's rows, the
// header box's, and the row editor's three input widgets. A third layer rather
// than a matcher in each of those components, for the reason the two above are
// in one file: all four of these keys mean something else in a row and
// something else again as a chord.
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

// A BARE Enter only. `⌘Enter` is still the mark and `Shift+Enter` still the
// note; a list being up must not swallow either, which is the one way this
// layer could quietly break the row layer under it.
test("a modified Enter is never the list's", () => {
  expect(listKey(key("Enter", { ctrl: true }))).toBeNull()
  expect(listKey(key("Enter", { meta: true }))).toBeNull()
  expect(listKey(key("Enter", { shift: true }))).toBeNull()
  expect(listKey(key("Enter", { alt: true }))).toBeNull()
  expect(listKey(key("ArrowDown", { alt: true, shift: true }))).toBeNull()
})

// ...and Escape is the exception, deliberately: it dismisses however it is
// pressed, because a person reaching for it wants the panel gone.
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
