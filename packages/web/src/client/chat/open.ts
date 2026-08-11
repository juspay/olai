/**
 * Whether the agent panel is open.
 *
 * Open-ness used to live only here. The panels rework co-located it with the
 * other layout preferences under `layout/prefs.ts` (widths, snap, sidebar).
 * This module re-exports the chat half so chat components keep a local import
 * path, and keeps `followChatOpen` as a named entry for the document-lifetime
 * listener started from `main.tsx` (now the full layout follow).
 */

export {
  chatOpen,
  setChatOpen,
  toggleChat,
  followLayout as followChatOpen,
} from "../layout/prefs.ts"
