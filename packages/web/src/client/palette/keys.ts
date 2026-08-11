/**
 * The keyboard map reserved so keyboard-editing cannot collide later:
 *
 *   ⌘K / Ctrl+K  — command palette
 *   ⌘\\ / Ctrl+\\ — toggle sidebar
 *   ⌘J / Ctrl+J  — toggle chat
 *
 * Meta on Apple, Ctrl elsewhere — both accepted so a Linux laptop and a Mac
 * share the same map. When the event target is an editable field, only ⌘K
 * still fires (summon from anywhere); panel toggles stay out of the way of
 * typing.
 */

export type KeyAction = "palette" | "sidebar" | "chat"

export interface KeyMatch {
  readonly action: KeyAction
  /** Whether this binding may fire while focus is in an input/textarea. */
  readonly whileEditing: boolean
}

const isMod = (event: KeyboardEvent): boolean => event.metaKey || event.ctrlKey

/**
 * Which reserved action a keydown is, or `null` if none.
 *
 * Pure of the DOM beyond the event itself so unit tests need no window.
 */
export const matchKey = (event: KeyboardEvent): KeyMatch | null => {
  if (!isMod(event) || event.altKey || event.shiftKey) return null
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
