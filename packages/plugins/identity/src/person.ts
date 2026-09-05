/**
 * HOW A PERSON IS ASKED FOR AND DRAWN IN THIS TAB — the door the chat row
 * reads, and the one edge between two plugins in this tree that is a
 * GRAPH rather than a name.
 *
 * ## Why the transcript reaches in here at all
 *
 * The panel names the person over each run of their own messages
 * (`olai-plugin-chat`'s `browser/chat/Speaker.tsx`), wearing the picture
 * this row's ladder resolved. Both faces answer one question — who is
 * looking at this page — and there is exactly one answer per connection,
 * so what they must share is not a look but the ASK: {@link whoAmI} is one
 * `who.get` for the whole tab, and a second asker would be one round trip
 * per run of a conversation for a value that cannot move while the socket
 * is open. A silhouette traced twice is the same drift one layer down.
 *
 * It used to be `@olai/web/client/who/*`, which the chat row imported for
 * the same three things and which is what makes this a MOVE rather than a
 * new coupling: the edge existed, pointing at core, while the chip was
 * core's. It points at the row that owns the subject now, and
 * `packages/bundle/src/fence.test.ts` records it in the one table a
 * manifest edge is recorded in.
 *
 * ## What a serve WITHOUT this row does to that face
 *
 * Nothing that needs an arm of its own. `who.get` is core's procedure and
 * answers `null` when nobody stands behind the `Identity` door, so the
 * transcript draws the same silhouette it draws for a serve behind no
 * proxy. The chunk carries three small modules and no wire of its own,
 * which is what makes a static import across two chunks the cheap way to
 * spell this rather than a slot.
 */

export { type Asking, type Who, createWho } from "./browser/asking.ts"
export { whoAmI } from "./browser/mine.ts"
export { saying } from "./browser/saying.ts"
export { UserIcon } from "./browser/UserIcon.tsx"
