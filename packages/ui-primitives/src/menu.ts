/** Shared paint for dropdown menus; the caller supplies its stacking layer. */
export const MENU_PANEL = "relative min-w-[11rem] overflow-y-auto rounded-surface border border-rule bg-panel p-1 text-body text-ink shadow-raised focus:outline-none"

/** One entry. `olai-menu-item` is not paint — it is the hook `./all.css` hangs
 *  the forced-colours band on. The band IS the walk: `data-[highlighted]` is
 *  where the keyboard is standing and where a pointer is hovering, and
 *  `bg-ink/8` is an author background, which Windows High Contrast throws away
 *  along with every other one — leaving a menu whose entries are all exactly
 *  alike. There is no `focus:outline-none` here any more: it was dead the day
 *  it was written (`@olai/appearance/chrome.css` is unlayered and its ring
 *  outranks every utility), and the ring it was aimed at is the one indicator
 *  in this app that forced colours does not delete. */
export const MENU_ITEM = "olai-menu-item cursor-pointer rounded-control px-2.5 py-1 text-left text-ink hover:bg-ink/5 data-[highlighted]:bg-ink/8"
