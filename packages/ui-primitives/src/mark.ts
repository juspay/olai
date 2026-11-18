/**
 * THE BOX A PLACE'S MARK IS DRAWN IN, wherever a name and a mark share a line:
 * the sidebar's Chats rows, the chat page's head, a palette row.
 *
 * A kind's glyph draws itself `h-full w-full` and takes whatever box its caller
 * gives it (`olai-plugin-files`' `Glyph` says so from the other side), so a mark
 * drawn with no box grows to the width of its row and pushes the name out. One
 * spelling, so the list that names a chat and the palette that names it cannot
 * size the same glyph two ways.
 */
export const MARK_BOX = "inline-flex h-3.5 w-[calc(0.875rem*18/16)] shrink-0 items-center"
