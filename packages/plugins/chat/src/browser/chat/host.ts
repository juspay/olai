/** What scrolls a node page's conversation: the nearest scrolling ancestor —
 *  a split pane — or the document. A fold's transcript is its own scroller and
 *  never asks. */
export const scrollHostOf = (from: HTMLElement): HTMLElement => {
  let parent = from.parentElement
  while (parent !== null && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement
  return parent ?? document.documentElement
}
