/** Short production spans used only by @sleep-fast scratch scenarios.
 *
 * The pass's own spans (`olai-plugin-chat`'s `settings.ts`, which holds the
 * defaults and the words): the product's are hours, and a test cannot wait for
 * any of them, so the tag writes these through the same declared config rather
 * than through a hook the product does not have.
 *
 * THE QUESTION SPAN IS THE ONE THAT IS NOT TINY, deliberately: the scenario that
 * uses it has to look at the alert faces WHILE the question is open, and the
 * pass cancels it when the span runs out. Fifteen seconds is a comfortable
 * window for those assertions under load. */
export const FAST_SLEEP = {
  after: "1ms",
  tick: "250ms",
  question: "15s",
  limit: "2m",
  // TWO MOVED ROWS IS ENOUGH, so a scenario can hold the difference between
  // "too little to tidy" and "due" with one extra write (`docs/chat.md`'s rule:
  // never slept, enough rows, or one waiting too long).
  floor: "2",
  // AND THE BACKSTOP IS THE PRODUCT'S OWN WEEK, which no scenario waits out —
  // which only holds because the rows a scenario moves are stamped at the
  // CLOCK'S NOW (`node_agent_sleeps_steps.ts` says why a fixed past date cannot
  // be used for them any more): with a fixed date every moved row would be older
  // than any sensible backstop, and every scenario would be due by it.
  latest: "7d",
} as const;
