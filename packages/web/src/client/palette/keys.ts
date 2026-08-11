/**
 * The keyboard map reserved so keyboard-editing cannot collide later:
 *
 *   ⌘K / Ctrl+K  — command palette
 *   ⌘\\ / Ctrl+\\ — toggle sidebar
 *   ⌘J / Ctrl+J  — toggle chat
 *
 * Platform: Meta on Apple (where Ctrl+K is kill-to-end-of-line in text
 * fields), Control elsewhere. Accepting both on every platform was wrong for
 * the palette's whileEditing binding. ⌘J / Ctrl+J and Ctrl+K also shadow
 * browser chrome defaults (downloads / search bar) — deliberate, so keyboard-
 * editing cannot claim those combos later.
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

const isMod = (event: KeyboardEvent): boolean => {
  if (wantsMeta()) return event.metaKey && !event.ctrlKey
  return event.ctrlKey && !event.metaKey
}

/**
 * Which reserved action a keydown is, or `null` if none.
 *
 * Pure of the DOM beyond the event itself so unit tests need no window.
 * Pass `platform` in tests to pin Apple vs not.
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
