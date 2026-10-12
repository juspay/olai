/** Short production spans used only by @sleep-fast scratch scenarios.
 *
 * The pass's own words (`olai-plugin-chat`'s `settings.ts`): a node agent is
 * left alone for `sleep-after`, olai looks every `sleep-tick`, and a turn that
 * sits on a question is stopped after `sleep-question`. Six hours, fifteen
 * minutes and twenty minutes are the product's; a test cannot wait for any of
 * them, so the tag writes these through the same declared config rather than
 * through a hook the product does not have. */
export const FAST_SLEEP = { after: "1ms", tick: "250ms", question: "6s" } as const;
