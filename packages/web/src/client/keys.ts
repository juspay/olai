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

export type KeyAction = "palette" | "sidebar" | "chat"

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
 * Which reserved action a keydown is, or `null` if none.
 *
 *   ⌘K / Ctrl+K  — command palette
 *   ⌘\ / Ctrl+\  — toggle sidebar
 *   ⌘J / Ctrl+J  — toggle chat
 *
 * Platform: Meta on Apple (where Ctrl+K is kill-to-end-of-line in text
 * fields), Control elsewhere. Accepting both on every platform was wrong for
 * the palette's whileEditing binding. ⌘J / Ctrl+J and Ctrl+K also shadow
 * browser chrome defaults (downloads / search bar) — deliberate, so keyboard
 * editing could not claim those combos later, and it has not.
 */
export const matchKey = (
  event: KeyboardEvent,
  platform?: string,
): KeyMatch | null => {
  const apple = platform !== undefined ? isApplePlatform(platform) : wantsMeta()
  const mod = apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  if (!mod || event.altKey || event.shiftKey) return null
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (key === "k") return { action: "palette", whileEditing: true }
  if (key === "\\") return { action: "sidebar", whileEditing: false }
  if (key === "j") return { action: "chat", whileEditing: false }
  return null
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
  if (event.key === "Enter" && event.shiftKey && !event.altKey) return "note"
  if (field === "block") return null

  if (event.key === "Enter") {
    if (event.ctrlKey || event.metaKey) return "toggle"
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
