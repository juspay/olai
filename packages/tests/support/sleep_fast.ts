/** Short production spans used only by @sleep-fast scratch scenarios.
 *
 * The pass's own words (`olai-plugin-chat`'s `settings.ts`): a node agent is
 * left alone for `sleep-after`, olai looks every `sleep-tick`, and a turn that
 * sits on a question is stopped after `sleep-question`. Six hours, fifteen
 * minutes and twenty minutes are the product's; a test cannot wait for any of
 * them, so the tag writes these through the same declared config rather than
 * through a hook the product does not have.
 *
 * THE QUESTION SPAN IS THE ONE THAT IS NOT TINY, deliberately: the scenario that
 * uses it has to look at the alert faces WHILE the question is open, and the
 * pass cancels it when the span runs out. Fifteen seconds is a comfortable
 * window for those assertions under load and still nothing like the product's
 * twenty minutes. */
export const FAST_SLEEP = { after: "1ms", tick: "250ms", question: "15s", limit: "2m" } as const;
