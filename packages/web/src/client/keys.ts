/**
 * The keyboard map: every key this app answers, decided in one file.
 *
 * It arrived as `palette/keys.ts` with the panel rework (#104), holding the
 * three reserved chords, and it moved up here when keyboard editing needed
 * keys of its own. One registry rather than two matchers in two components is
 * the whole point: a chord and an editing key that both claim `Ctrl+Enter`
 * disagree silently, in a browser, at the moment somebody is typing — and the
 * only place that disagreement is visible is a file that declares both.
 *
 * Two LAYERS, and they never overlap, which is what makes them safe together:
 *
 *   - {@link matchKey} is the GLOBAL layer — chords with a modifier, listened
 *     for on the window (`palette/Palette.tsx` owns the one listener), and
 *     each says whether it may fire while focus is in a text field.
 *   - {@link editKey} is the ROW layer — the Workflowy keys, matched on the
 *     editor's own element and nowhere else. They are bare keys (`Enter`,
 *     `Tab`, the arrows), so a global listener claiming them would eat every
 *     keystroke in the chat composer and in the palette's own input. An
 *     editor's keys belong to the editor.
 *
 * Pure of the DOM beyond the event itself, so both layers are unit-testable
 * with no window: pass `platform` to pin Apple vs not.
 */

export type KeyAction = "palette" | "sidebar" | "chat" | "undo" | "redo"

export interface KeyMatch {
  readonly action: KeyAction
  /** Whether this binding may fire while focus is in an input/textarea. */
  readonly whileEditing: boolean
}

/** Apple platforms where Meta is the primary modifier and Ctrl+K is readline. */
export const isApplePlatform = (
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): boolean => /Mac|iPhone|iPad|iPod/i.test(platform)

const wantsMeta = (): boolean => isApplePlatform()

/**
 * The reserved chords, as a table.
 *
 *   ⌘K / Ctrl+K   — command palette
 *   ⌘\ / Ctrl+\   — toggle sidebar
 *   ⌘J / Ctrl+J   — toggle chat
 *   ⌘Z / Ctrl+Z   — undo the last edit this tab made
 *   ⌘⇧Z / Ctrl+⇧Z — redo it
 *
 * ⌘J / Ctrl+J and Ctrl+K shadow browser chrome defaults (downloads / search
 * bar) — deliberate, so keyboard editing could not claim those combos later,
 * and it has not.
 *
 * ⌘Z is the one chord with a SHIFTED twin, which is why `shift` is a field
 * rather than a blanket "no shift" test in the matcher: undo and redo are one
 * key and a modifier everywhere a person has ever pressed them, and spelling
 * redo as a different letter to keep the matcher simple would be this app
 * inventing a keyboard. Both are `whileEditing: false` — a draft has the
 * platform's own undo in it (an `<input>` brings its own, which is half the
 * argument for the input in `edit/RowEditor.tsx`), and abandoning a draft is
 * Escape's. So the row editor never sees these, and the stack never contains
 * half a typed line.
 *
 * That is a rule about the CARET, and not about text: once a draft has
 * committed, what it produced is an op like any other and ⌘Z takes it back
 * with the row's own text. Reading these two as one thing is what shipped an
 * undo that answered "nothing to undo" to somebody who had just retyped a
 * title (human, 2026-08-12).
 *
 * A table rather than a chain of `if`s because the collision test below reads
 * it: the one invariant this file exists for is checked against THIS list, so
 * a fifth chord is covered by being added rather than by somebody remembering
 * to add it twice.
 */
export const CHORDS: ReadonlyArray<
  KeyMatch & { readonly key: string; readonly shift?: boolean }
> = [
  { key: "k", action: "palette", whileEditing: true },
  { key: "\\", action: "sidebar", whileEditing: false },
  { key: "j", action: "chat", whileEditing: false },
  { key: "z", action: "undo", whileEditing: false },
  { key: "z", action: "redo", whileEditing: false, shift: true },
]

/**
 * Which reserved action a keydown is, or `null` if none.
 *
 * Platform: Meta on Apple (where Ctrl+K is kill-to-end-of-line in text
 * fields), Control elsewhere. Accepting both on every platform was wrong for
 * the palette's whileEditing binding.
 *
 * Shift is matched EXACTLY — a chord that does not ask for it is dead with it
 * held — so ⌘Z and ⌘⇧Z are two entries rather than one entry and a caller that
 * reads the event again.
 */
export const matchKey = (
  event: KeyboardEvent,
  platform?: string,
): KeyMatch | null => {
  const apple = platform !== undefined ? isApplePlatform(platform) : wantsMeta()
  const mod = apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  if (!mod || event.altKey) return null
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  return CHORDS.find(
    (chord) => chord.key === key && (chord.shift ?? false) === event.shiftKey,
  ) ?? null
}

/** Is the event target (or its composed path) an editable field? */
export const isEditingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  const el =
    target.closest("input, textarea, select, [contenteditable=true]") ??
    (target instanceof HTMLElement && target.isContentEditable ? target : null)
  return el !== null
}

// ── the row layer ──────────────────────────────────────────────────────

/**
 * What a key does inside a row's editor. Workflowy's set, minus everything
 * deferred to its own roadmap item — there is no delete, no split, no merge
 * and no multi-select here, so no key spells one.
 *
 *   - `add` — `Enter`: commit what is typed and open the next row's editor.
 *   - `in` / `out` — `Tab` / `Shift+Tab`.
 *   - `up` / `down` — `Alt+Shift+↑/↓`, moving among siblings. The four names
 *     are the surface's own `move` verbs, spelled once
 *     ({@link ../../../surface/src/edit.ts}).
 *   - `toggle` — `Ctrl+Enter` (and `⌘+Enter`, which is what Workflowy trains
 *     an Apple reader's hands to reach for; neither collides with the three
 *     reserved chords above, none of which is `Enter`).
 *   - `walk` — `Ctrl+Shift+Enter` (`⌘⇧Enter`): the MARK WALK, which is how a
 *     person writes the other two marks and takes one off. `Enter` is the row's
 *     key and a modifier says which kind of change it is, so the mark keys are
 *     one chord apart — and SHIFT is already this app's "the same key, one step
 *     further" (`Shift+Tab` against `Tab`, `⌘⇧Z` against `⌘Z`). Which answer a
 *     step lands on is the server's, over the mark the node actually carries
 *     ({@link ../../../server/src/edit.ts} holds the ring, and the argument for
 *     `done` not being on it).
 *   - `note` — `Shift+Enter`: open the note under the row, and close it again
 *     from inside.
 *   - `prev` / `next` — the bare arrows, moving the caret between rows. The
 *     title editor is ONE LINE, so ↑ and ↓ have nothing else they could mean
 *     there, which is why they need no caret-position test.
 *   - `cancel` — `Escape`: abandon the draft.
 */
export type EditAction =
  | "add"
  | "in"
  | "out"
  | "up"
  | "down"
  | "toggle"
  | "walk"
  | "note"
  | "prev"
  | "next"
  | "cancel"

/**
 * Which field is being edited, because two of these keys mean different things
 * in a note than on a title.
 *
 *   - `line` — the title: one verbatim line, so `Enter` is "next row" and the
 *     arrows are "next row" too.
 *   - `block` — the note: prose, so `Enter` is a newline and the arrows move
 *     the caret. Only `Shift+Enter` (close it) and `Escape` (abandon it) are
 *     this layer's, and everything else is the textarea's own.
 */
export type EditField = "line" | "block"

export const editKey = (
  event: KeyboardEvent,
  field: EditField,
): EditAction | null => {
  // Order matters: every branch below is a more specific reading of a key a
  // later branch also matches, and the modifiers are what tell them apart.
  if (event.key === "Escape") return "cancel"
  // The NOTE is `Shift+Enter` and nothing else on top of it — the bare pair.
  // Adding Ctrl or Meta makes it the mark walk, one branch down, which is why
  // this test names the two modifiers it must not see rather than letting an
  // earlier match swallow the chord. Both mark keys then live in the one
  // `Enter`-with-a-modifier branch, where they are legible as the pair they
  // are, and both are dead in a note for the reason everything below is: a
  // note is prose, and the keys that edit a ROW are the row's.
  if (
    event.key === "Enter" && event.shiftKey && !event.altKey && !event.ctrlKey &&
    !event.metaKey
  ) return "note"
  if (field === "block") return null

  if (event.key === "Enter") {
    if (event.ctrlKey || event.metaKey) return event.shiftKey ? "walk" : "toggle"
    if (event.altKey) return null
    return "add"
  }
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return event.shiftKey ? "out" : "in"
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const down = event.key === "ArrowDown"
    // Alt+Shift is the MOVE; the bare arrow is the caret. Both, so a reader
    // whose hands are on the first never has to reach for a mouse to do the
    // second.
    if (event.altKey && event.shiftKey) return down ? "down" : "up"
    if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      return down ? "next" : "prev"
    }
  }
  return null
}

/**
 * The keys, written down for a PERSON.
 *
 * Beside the two matchers rather than in a document somewhere, for the reason
 * the matchers are beside each other: what a key does and what it is said to
 * do are one fact, and a second home for the sentence is a sentence that goes
 * stale. What draws this is `palette/Shortcuts.tsx`; `keys.test.ts` holds it
 * to covering every {@link EditAction}, so a key added without a sentence
 * fails rather than shipping undocumented.
 *
 * The chords say ⌘ and Ctrl the way {@link matchKey} reads them: Meta on
 * Apple, Control elsewhere. One string with both, because a reference a person
 * reads on one machine is often about the other.
 */
export interface Shortcut {
  readonly keys: string
  readonly what: string
  /** The editing action it is, when it is one — what the test checks the list
   *  against. Absent for the global chords, which are not row actions. */
  readonly action?: EditAction
}

export const SHORTCUTS: ReadonlyArray<{
  readonly group: string
  readonly keys: ReadonlyArray<Shortcut>
}> = [
  {
    group: "Anywhere",
    keys: [
      { keys: "⌘K / Ctrl+K", what: "the command palette" },
      { keys: "⌘\\ / Ctrl+\\", what: "show or hide the directory" },
      { keys: "⌘J / Ctrl+J", what: "show or hide the agent" },
      { keys: "⌘Z / Ctrl+Z", what: "take back your last edit on this outline" },
      { keys: "⌘⇧Z / Ctrl+⇧Z", what: "put it back" },
    ],
  },
  {
    group: "In a row",
    keys: [
      { keys: "Click a title", what: "put the caret in it" },
      { keys: "Enter", what: "commit, and open the next line", action: "add" },
      { keys: "Tab", what: "indent under the row above", action: "in" },
      { keys: "Shift+Tab", what: "outdent, after the old parent", action: "out" },
      { keys: "Alt+Shift+↑", what: "move up among its siblings", action: "up" },
      { keys: "Alt+Shift+↓", what: "move down among its siblings", action: "down" },
      { keys: "⌘Enter / Ctrl+Enter", what: "tick it off, or take that back", action: "toggle" },
      {
        keys: "⌘⇧Enter / Ctrl+⇧Enter",
        what: "walk the mark on: to do, then doing, then none",
        action: "walk",
      },
      { keys: "Shift+Enter", what: "write the note under it", action: "note" },
      { keys: "↑ / ↓", what: "walk to the row above or below", action: "prev" },
      { keys: "Escape", what: "drop what you were typing", action: "cancel" },
    ],
  },
  {
    group: "In a note",
    keys: [
      { keys: "Click a note", what: "put the caret in it" },
      { keys: "Enter", what: "a new line — a note is prose" },
      { keys: "Shift+Enter", what: "close it, and render it again" },
      { keys: "Escape", what: "drop what you were typing" },
    ],
  },
]
