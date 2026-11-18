/**
 * A PANE THAT KEEPS WHAT IT IS DRAWING — where a plain press inside it lands.
 *
 * A press on a link replaces the page in the pane the link sits in, which is
 * right for everything a pane draws BY reading it: a document, an outline, a
 * search. It is wrong for a pane that draws something a person is in the
 * middle of — a conversation — because the press is about the thing being
 * talked about and the cost of being wrong is the thing itself. One press on a
 * path an agent wrote would swallow the conversation that wrote it, and
 * nothing brings a half-typed message and a scroll position back.
 *
 * So such a pane MARKS ITS SUBTREE with {@link LINKS_ELSEWHERE} and a plain
 * press inside it goes to the OTHER pane: the one to its left when there is
 * one, else the one it opens to its right. `Alt` keeps its meaning — it has
 * always meant "to the right", and a reader who asked for that asked for it
 * here too.
 *
 * ### Why the left one
 *
 * Because a conversation is about something, and the two are read in the
 * order a person reads: the thing on the left, the agent talking about it on
 * the right (`olai-plugin-chat`'s *Open <name> beside*). A pane on the left
 * is where that thing already is, so a press lands where the eye already goes
 * — and a chat opened beside a document keeps pointing at the same column
 * however many links are pressed. With nothing to the left there is no such
 * column yet, and one is opened on the right rather than invented at the far
 * end of a layout the person did not arrange.
 *
 * ### Why navigation owns it
 *
 * Because it is a rule about PANES and presses, which is this row's
 * vocabulary, and because every surface that follows a link goes through one
 * function ({@link follow}): the window's own listener, the opaque-frame
 * bridge, a preview card. A rule kept by the plugin that draws the
 * conversation would have to be re-kept by each of them, and the frame bridge
 * has no components at all.
 */

/** The attribute a face marks its subtree with. An ATTRIBUTE rather than a
 *  prop or a context, because the reader is a document-level press handler
 *  holding an `<a>` and nothing else — content drawn by a markdown renderer,
 *  by a plugin's face, or inside an opaque frame's bridge. */
export const LINKS_ELSEWHERE = "data-links-elsewhere"

/** ...and the attribute as a selector, for the one `closest` that reads it. */
export const ELSEWHERE_SELECTOR = `[${LINKS_ELSEWHERE}]`

/** WHICH PANE A PRESS INSIDE SUCH A SUBTREE IS FOR: the pane to the left of
 *  the one it was pressed in (`into`), or the pane that one opens to its
 *  right (`beside`, which reuses a pane already there — `Router.openRight`). */
export type Elsewhere =
  | { readonly kind: "into"; readonly index: number }
  | { readonly kind: "beside"; readonly from: number }

/** The whole rule, as a function of the pressed pane's index. */
export const elsewhereOf = (index: number): Elsewhere =>
  index > 0 ? { kind: "into", index: index - 1 } : { kind: "beside", from: index }
