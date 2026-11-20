export type KeyAction =
  | "palette"
  | "sidebar"
  | "undo"
  | "redo"
  | "closePane"
  | "done"

export interface KeyMatch {
  readonly action: KeyAction
  readonly whileEditing: boolean
}

export const isApplePlatform = (
  platform: string = typeof navigator !== "undefined" ? navigator.platform : "",
): boolean => /Mac|iPhone|iPad|iPod/i.test(platform)

const wantsMeta = (): boolean => isApplePlatform()

const onApple = (platform?: string): boolean =>
  platform !== undefined ? isApplePlatform(platform) : wantsMeta()

export const CHORDS: ReadonlyArray<
  KeyMatch & { readonly key: string; readonly shift?: boolean }
> = [
  { key: "k", action: "palette", whileEditing: true },
  { key: "\\", action: "sidebar", whileEditing: false },
  { key: "z", action: "undo", whileEditing: false },
  { key: "z", action: "redo", whileEditing: false, shift: true },
  { key: "w", action: "closePane", whileEditing: true, shift: true },
  { key: "o", action: "done", whileEditing: true },
]

export const matchKey = (
  event: KeyboardEvent,
  platform?: string,
): KeyMatch | null => matchChord(event, CHORDS, platform)

const UNSHIFTED: Readonly<Record<string, string>> = { Period: ".", Comma: "," }

export const matchChord = <T extends { readonly key: string; readonly shift?: boolean }>(
  event: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
  table: ReadonlyArray<T>,
  platform?: string,
): T | null => {
  const apple = onApple(platform)
  const mod = apple
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
  if (!mod || event.altKey) return null
  const key = (event.shiftKey ? UNSHIFTED[event.code] : undefined)
    ?? (event.key.length === 1 ? event.key.toLowerCase() : event.key)
  return table.find(
    (chord) => chord.key === key && (chord.shift ?? false) === event.shiftKey,
  ) ?? null
}

const NOT_TEXT = new Set(["checkbox", "radio", "button", "submit", "reset", "range", "color"])

export const isEditingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof Element)) return false
  const el =
    target.closest("input, textarea, select, [contenteditable=true]") ??
    (target instanceof HTMLElement && target.isContentEditable ? target : null)
  if (el instanceof HTMLInputElement && NOT_TEXT.has(el.type)) return false
  return el !== null
}

export type EditAction =
  | "add"
  | "insert"
  | "split"
  | "merge"
  | "in"
  | "out"
  | "up"
  | "down"
  | "zoomIn"
  | "zoomOut"
  | "fold"
  | "collapse"
  | "expand"
  | "toggle"
  | "cancel-mark"
  | "walk"
  | "duplicate"
  | "moveTo"
  | "note"
  | "prev"
  | "next"
  | "left"
  | "right"
  | "cancel"
  | "selectUp"
  | "selectDown"
  | "selectAll"

export type EditField = "line" | "block"

export interface Caret {
  readonly start: number
  readonly end: number
  readonly text: string
}

export const editKey = (
  event: KeyboardEvent,
  field: EditField,
  at?: Caret,
  platform?: string,
): EditAction | null => {
  const apple = onApple(platform)
  if (event.key === "Escape") return "cancel"
  if (
    event.key === "Enter" && event.shiftKey && !event.altKey && !event.ctrlKey &&
    !event.metaKey
  ) return "note"
  if (field === "block") return null

  const bare = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
  switch (event.key) {
    case "d":
    case "D":
      return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey
        ? "duplicate"
        : null
    case "m":
    case "M":
      return (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey
        ? "moveTo"
        : null
    // ⌘ on Apple: macOS's ⌥ is its text modifier there (⌥. types ≥, ⌥, types ≤).
    case ".":
    case ",":
      return !event.shiftKey &&
          (apple
            ? event.metaKey && !event.ctrlKey && !event.altKey
            : event.altKey && !event.ctrlKey && !event.metaKey)
        ? (event.key === "." ? "zoomIn" : "zoomOut")
        : null
    case " ":
      return event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
        ? "fold"
        : null
    case "Enter":
      if (event.ctrlKey || event.metaKey) return event.shiftKey ? "walk" : "toggle"
      if (event.altKey) return event.shiftKey ? null : "cancel-mark"
      if (at !== undefined && halves(at)) return "split"
      if (
        at !== undefined && at.start === 0 && at.end === 0 && at.text.trim() !== ""
      ) return "insert"
      return "add"
    case "Backspace":
      return bare && at !== undefined && at.start === 0 && at.end === 0 ? "merge" : null
    case "Tab":
      return !event.ctrlKey && !event.metaKey && !event.altKey
        ? (event.shiftKey ? "out" : "in")
        : null
    case "ArrowUp":
    case "ArrowDown": {
      const down = event.key === "ArrowDown"
      if (event.altKey && event.shiftKey) return down ? "down" : "up"
      if (apple && event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey) {
        return down ? "down" : "up"
      }
      // ⌘ on Apple: macOS takes Ctrl+↑/↓ for Mission Control and App Exposé.
      if (
        (apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey) &&
        !event.altKey && !event.shiftKey
      ) return down ? "expand" : "collapse"
      if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
        return down ? "selectDown" : "selectUp"
      }
      if (bare) return down ? "next" : "prev"
      return null
    }
    case "ArrowLeft":
      return bare && at !== undefined && at.start === 0 && at.end === 0 ? "left" : null
    case "ArrowRight":
      return bare && at !== undefined && at.start === at.end && at.end === at.text.length
        ? "right"
        : null
    case "a":
    case "A":
      return at !== undefined && whole(at) && !event.shiftKey && !event.altKey &&
          (event.ctrlKey || event.metaKey)
        ? "selectAll"
        : null
    default:
      return null
  }
}

const whole = (at: Caret): boolean =>
  at.text.length > 0 && at.start === 0 && at.end === at.text.length

export type SelectAction =
  | "complete"
  | "in"
  | "out"
  | "up"
  | "down"
  | "growUp"
  | "growDown"
  | "all"
  | "clear"

export const selectKey = (event: KeyboardEvent, platform?: string): SelectAction | null => {
  const apple = onApple(platform)
  if (event.key === "Escape") return "clear"
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
    return "complete"
  }
  if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return event.shiftKey ? "out" : "in"
  }
  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    const down = event.key === "ArrowDown"
    if (event.altKey && event.shiftKey) return down ? "down" : "up"
    if (apple && event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey) {
      return down ? "down" : "up"
    }
    if (event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      return down ? "growDown" : "growUp"
    }
  }
  if (
    !event.shiftKey && !event.altKey && (event.key === "a" || event.key === "A") &&
    (event.ctrlKey || event.metaKey)
  ) return "all"
  return null
}

const halves = (at: Caret): boolean =>
  at.text.slice(0, at.start).trim() !== "" && at.text.slice(at.end).trim() !== ""

export type ListAction = "next" | "prev" | "take" | "dismiss"

export type PaneAction = "focusLeft" | "focusRight"

export const paneKey = (
  event: KeyboardEvent,
  editing: boolean,
): PaneAction | null => {
  if (editing) return null
  if (!event.altKey || event.shiftKey || event.ctrlKey || event.metaKey) {
    return null
  }
  if (event.key === "ArrowLeft") return "focusLeft"
  if (event.key === "ArrowRight") return "focusRight"
  return null
}

export function listKey(event: KeyboardEvent): ListAction | null
export function listKey(event: KeyboardEvent, tabs: true): ListAction | "cycle" | null
export function listKey(event: KeyboardEvent, tabs = false): ListAction | "cycle" | null {
  if (event.key === "Escape") return "dismiss"
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (tabs && event.key === "Tab") return "cycle"
  if (event.key === "ArrowDown") return "next"
  if (event.key === "ArrowUp") return "prev"
  if (event.key === "Enter") return "take"
  return null
}

export interface Shortcut {
  readonly keys: string
  readonly what: string
  readonly action?: EditAction
  readonly list?: ListAction
}

export const SHORTCUTS: ReadonlyArray<{
  readonly group: string
  readonly keys: ReadonlyArray<Shortcut>
}> = [
  {
    group: "Anywhere",
    keys: [
      { keys: "⌘K / Ctrl+K", what: "Command palette" },
      { keys: "⌘\\ / Ctrl+\\", what: "Show or hide the sidebar" },
      { keys: "⌘Z / Ctrl+Z", what: "Undo your last edit on this outline" },
      { keys: "⌘⇧Z / Ctrl+⇧Z", what: "Redo" },
      { keys: "⌘⇧W / Ctrl+⇧W", what: "Close the focused pane" },
      {
        keys: "⌘O / Ctrl+O",
        what: "Show or hide finished items on this page",
      },
    ],
  },
  {
    group: "Among panes",
    keys: [
      {
        keys: "Alt+← / Alt+→",
        what: "Move to the pane on that side when not typing",
      },
      { keys: "Alt+click", what: "Open a link in the pane to the right" },
      { keys: "Alt+Shift+click", what: "Open a link in a new pane to the right" },
    ],
  },
  {
    group: "In a row",
    keys: [
      { keys: "Click a title", what: "Put the cursor where you clicked" },
      { keys: "Enter", what: "Finish the row and start the next", action: "add" },
      { keys: "Enter at the start", what: "Insert a blank row above", action: "insert" },
      { keys: "Enter mid-line", what: "Split the row in two", action: "split" },
      {
        keys: "Backspace at the start",
        what: "Join this row onto the one above",
        action: "merge",
      },
      { keys: "Tab", what: "Indent under the row above", action: "in" },
      { keys: "Shift+Tab", what: "Outdent", action: "out" },
      { keys: "Alt+Shift+↑ (Mac: ⌘⇧↑ too)", what: "Move up", action: "up" },
      { keys: "Alt+Shift+↓ (Mac: ⌘⇧↓ too)", what: "Move down", action: "down" },
      { keys: "⌘. / Alt+.", what: "Zoom into this row", action: "zoomIn" },
      { keys: "⌘, / Alt+,", what: "Zoom out", action: "zoomOut" },
      { keys: "Ctrl+Space", what: "Collapse or expand this row", action: "fold" },
      { keys: "⌘↑ / Ctrl+↑", what: "Collapse this row", action: "collapse" },
      { keys: "⌘↓ / Ctrl+↓", what: "Expand this row", action: "expand" },
      { keys: "⌘Enter / Ctrl+Enter", what: "Mark done, or undo that", action: "toggle" },
      {
        keys: "⌥Enter / Alt+Enter",
        what: "Mark cancelled, or undo that",
        action: "cancel-mark",
      },
      {
        keys: "⌘⇧Enter / Ctrl+⇧Enter",
        what: "Cycle the mark: to do, doing, none",
        action: "walk",
      },
      {
        keys: "⌘⇧D / Ctrl+⇧D",
        what: "Duplicate the row and everything under it",
        action: "duplicate",
      },
      {
        keys: "⌘⇧M / Ctrl+⇧M",
        what: "Move the row under another row you search for",
        action: "moveTo",
      },
      { keys: "Shift+Enter", what: "Write a note under the row", action: "note" },
      { keys: "↑ / ↓", what: "Go to the row above or below", action: "prev" },
      {
        keys: "← / → at either end",
        what: "Go to the row before or after",
        action: "left",
      },
      {
        keys: "Shift+↑ / Shift+↓",
        what: "Start selecting rows from this one",
        action: "selectUp",
      },
      {
        keys: "⌘A / Ctrl+A twice",
        what: "Select the text, then this row and its siblings",
        action: "selectAll",
      },
      { keys: "Escape", what: "Discard what you were typing", action: "cancel" },
    ],
  },
  {
    group: "While typing a title",
    keys: [
      { keys: "!", what: "A date in words: `tomorrow`, `next fri`, `aug 20`" },
      { keys: "# / @", what: "A tag you already use" },
      { keys: "((", what: "Search for a row and mirror it here" },
      { keys: "↓", what: "Next suggestion", list: "next" },
      { keys: "↑", what: "Previous suggestion", list: "prev" },
      { keys: "Enter", what: "Pick the highlighted suggestion", list: "take" },
      { keys: "Escape", what: "Close the list and keep typing", list: "dismiss" },
    ],
  },
  {
    group: "With rows selected",
    keys: [
      { keys: "Drag a bullet", what: "Move the rows and everything under them" },
      { keys: "⌘-click / Ctrl-click", what: "Add a row to the selection, or remove it" },
      { keys: "Shift-click", what: "Select everything between" },
      { keys: "Shift+↑ / Shift+↓", what: "Select one more row, or one fewer" },
      { keys: "⌘A / Ctrl+A", what: "Select the whole page" },
      { keys: "Tab / Shift+Tab", what: "Indent or outdent them" },
      { keys: "Alt+Shift+↑/↓ (Mac: ⌘⇧↑/↓ too)", what: "Move them up or down" },
      { keys: "⌘Enter / Ctrl+Enter", what: "Mark them done, or undo that" },
      { keys: "Escape", what: "Clear the selection" },
    ],
  },
  {
    group: "In a note",
    keys: [
      { keys: "Click a note", what: "Put the cursor in it" },
      { keys: "Enter", what: "New line" },
      { keys: "Shift+Enter", what: "Finish the note" },
      { keys: "Escape", what: "Discard what you were typing" },
    ],
  },
]
