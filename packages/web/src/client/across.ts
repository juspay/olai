/**
 * The one sentence this app has for "a parent is always in the same file".
 *
 * TWO GESTURES can ask for a cross-file parent, and both have to answer before
 * the write rather than after it: a row dragged over the pane of another
 * outline (`drag/aim.ts`) and a destination chosen out of the move-to picker's
 * search of the whole set (`move/destination.ts`). Each says the LAW in the
 * same words and leads into it differently, because what the reader is pointing
 * at differs — a pane has a file and a picked row has a title.
 *
 * It is here rather than in either of them because it belongs to neither, and
 * two copies of a sentence is how two faces of one rule start disagreeing in
 * the small words. The law's authoritative spelling is still the OPS layer's
 * (`ops/src/plan.ts`'s `planMove` refuses the same move in nearly these words):
 * these are what a person reads a moment earlier, and they are kept close to it
 * on purpose, so somebody who then meets an agent's refusal reads one story.
 */

export const SAME_FILE =
  "Every outline is an independent tree, so a parent is always in the same " +
  "file — archiving is what moves a subtree between them, and a mirror is " +
  "how one node is drawn in two."
