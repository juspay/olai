/**
 * AUTOSAVE: the rule the two markdown editors write by, in one place.
 *
 * Ruled 2026-08-18 (md-live-preview-editor). A note and a document are one
 * editor at two sizes (`../mde/`), so they are one rule at two sizes, and it
 * has four parts:
 *
 *   - **no Save button and no dirty flag.** What is in the editor is what the
 *     file is about to say; there is no second state a person has to remember
 *     to discharge, and nothing on screen that means "this is not saved yet".
 *   - **a debounced write on {@link AUTOSAVE_IDLE} of quiet**, plus a FLUSH
 *     when the caret leaves. The debounce is idle-keyed rather than periodic,
 *     which is the answer to the concern the document editor's own header used
 *     to raise: a timer that fired mid-sentence would publish half a sentence
 *     to every open tab, and a timer that only fires when somebody has STOPPED
 *     does not.
 *   - **every write is CONDITIONAL**, with `was` set to the text this editor
 *     last saved. So a concurrent write — vim on the same file, an agent on
 *     the same node — is refused by the ops layer rather than overwritten, in
 *     the ops layer's own words.
 *   - **a refusal is on the page**, under the editor it came from, and the
 *     text stays exactly where it was typed. Nothing a person wrote may be
 *     lost because a validator said no, and nothing anyone ELSE wrote may be
 *     lost because a timer fired.
 *
 * The one door out of a refusal is a person's: OVERWRITE, an explicit second
 * verb that sends no `was` and means exactly what it says
 * (`../document/DocEditor.tsx`).
 *
 * WHAT THIS FILE IS NOT is a scheduler. The two surfaces already own their own
 * commit loops — a row's draft goes through the editor's queue with the caret
 * and the keys around it (./editing.tsx), a document's is one text and one
 * write — and folding those into one timer would be a third machine sitting
 * between a person and a file. What has to be shared is the NUMBER and the
 * rule, and the number is shared because two surfaces disagreeing about how
 * long a pause is would be two answers to one question a person asks with
 * their hands.
 */

/**
 * How long a person stops typing before what they typed is written.
 *
 * Half a second: short enough that walking away from the keyboard cannot lose
 * a paragraph, long enough that a pause to think is not a git commit. It is
 * deliberately shorter than a TITLE's ({@link ./draft.ts}'s `IDLE_COMMIT`),
 * and the difference is what the two fields are: a title is one line that is
 * nearly always finished by `Enter` or a click away, so its timer is a
 * backstop; a note is prose somebody sits inside for minutes at a time, where
 * the timer is the ONLY thing that ever writes.
 */
export const AUTOSAVE_IDLE = 500
