/**
 * `chat.dock` — PUTTING A CONVERSATION BESIDE THE PAGE, as a row that is not
 * chat asks for it.
 *
 * ## The two facts another row needs, and not one more
 *
 * A plugin with a conversation of its own — one it started through
 * `chat.conversations` ({@link ./conversations.ts}) — wants a door on its page
 * that says *talk to it*. That gesture is two questions: put THIS node in the
 * seat beside the page, and is there a seat at all. Everything else about the
 * dock is chat's and the shell's: the width, the handle, the preference this
 * browser remembers it under, whether the column is open, the picker it draws
 * when nothing is docked. A consumer that could reach those would be a second
 * author of the column's behaviour.
 *
 * So the door is {@link DockDoor.open} and {@link DockDoor.desktop}, and the
 * narrowness is the point: the live `Dock` this is a reading of
 * ({@link ./browser/dock.ts}) is NOT exported from this package, and neither
 * is the holder it lives in. A consumer's walk through this module reaches a
 * type and a string.
 *
 * ## OFFERED BY A COMPONENT, which is what makes absence honest
 *
 * The dock is `olai-plugin-chat/browser`'s `dock` COMPONENT, because it needs
 * the shell's seat and content under another layout — a phone-shaped serve, a
 * page rendered outside the app frame — has none. That component offers this
 * key over the `Dock` it creates, so a consumer that declares it waits for the
 * same thing the seat waits for: no shell, no dock, a component held `waiting`
 * naming *chat.dock*, and a page that simply does not draw a *Talk to it*
 * door rather than one that throws when pressed.
 *
 * {@link DockDoor.desktop} is the narrower question UNDERNEATH that: the dock
 * exists (a shell is mounted) but this viewport has no room for a column. A
 * consumer draws no door for `false`; the ⌘J chord and chat's own toggle
 * answer the same reading, so the two cannot disagree about whether there is
 * somewhere to put a conversation.
 */
import { serviceTag } from "@olai/plugin-api/contracts"

/** What chat offers of its dock: put a conversation in the seat, and whether
 *  there is a seat to put one in. */
export interface DockDoor {
  /** Dock this node's conversation and open the column. */
  readonly open: (node: string) => void
  /** Whether this viewport has a seat at all — `false` on a phone, where the
   *  conversation is read on its own page instead. */
  readonly desktop: () => boolean
}

/** The local word chat's `dock` component offers it under. */
export const DOCK = "dock"

export const chatDock = serviceTag<DockDoor>("chat.dock")
