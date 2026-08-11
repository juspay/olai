/**
 * Whether the agent panel is open.
 *
 * Re-exports the chat half of `layout/prefs.ts` so chat components keep a
 * local import path. Cross-tab follow for *all* layout prefs lives on
 * `followLayout` (started from `main.tsx`); this module no longer owns a
 * separate listener.
 */

export { chatOpen, setChatOpen, toggleChat } from "../layout/prefs.ts"
