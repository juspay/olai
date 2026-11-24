/** ONE TAB SHAPE for the frame's two rows of tabs: the desktop's tabs in the
 *  header (`olai-plugin-tabs`' strip) and a phone's pane tabs (`../pane/Panes.tsx`).
 *  Each row sets its own size and padding; what makes a tab a tab is here.
 *
 *  The tab in front is paper with a rule round its top and sides, standing on
 *  the row's hairline and painting over it where it meets its page; one
 *  behind is the muted word on the row's own ground. `olai-tab-filled` is the
 *  forced-colours hook (`@olai/ui-primitives/all.css`): paper under the front
 *  tab is a background, and High Contrast throws author backgrounds away.
 *
 *  Paint only, as {@link ./entry.ts}'s shapes are: which tab is in front is
 *  the caller's to say, by putting {@link TAB_FRONT} or {@link TAB_BEHIND} in
 *  its `classList` — never both, so no class has to win over another. */
export const TAB = "olai-tab-filled max-w-[14rem] rounded-t-control border border-b-0 text-label"

/** The tab in front. */
export const TAB_FRONT = "border-rule bg-paper font-medium text-ink"

/** A tab behind it. */
export const TAB_BEHIND = "border-transparent text-muted hover:text-ink"
