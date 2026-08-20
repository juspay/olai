/**
 * Whether a finished commit is followed by a push.
 *
 * The composition the Auto-push preference asks for: a commit from THIS
 * browser's Commit button, then the same push the panel's Push button runs.
 * The preference is `../settings/autopush.ts`; this file is the rule that
 * reads a finished attempt and decides. Agent `commit` ops never come
 * through here.
 *
 * Only a commit that RECORDED is followed. A refusal, a busy repository, or
 * nothing to commit are not a thing to send — and Auto-push off is today's
 * behaviour, untouched. A push that then fails is still a push the panel
 * already knows how to draw: nothing is rolled back, nothing is retried.
 */

/**
 * Follow `push` when Auto-push is on and the attempt actually recorded.
 *
 * `push` is the same verb the panel's button runs — mocked in the test
 * beside this file, the live `send` in `./state.ts`.
 */
export const afterCommit = (
  autoPush: boolean,
  tag: string,
  push: () => void,
): void => {
  if (autoPush && tag === "Committed") push()
}
