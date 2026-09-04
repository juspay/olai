/**
 * How close to the bottom of the transcript still counts as being AT it.
 *
 * One number, in a module of its own, for the reason {@link ./live.ts}'s
 * constant is: two places measure this slack and they must measure the same
 * one. The pane decides whether a reader is following the newest line by it
 * ({@link ./Transcript.tsx}), and the browser suite asserts against the same
 * threshold — anything under a line or two and a smooth scroll mid-flight
 * reads as "the reader scrolled away".
 *
 * WHY IT IS NOT ON THE PANE it belongs to, which is where it started: a step
 * definition importing a COMPONENT to read a number drags that component's
 * whole import graph into a process that has no browser in it, and the chat
 * panel's graph reaches the wire — which dials at module scope and throws
 * without a `location`. It did, and the suite stopped booting the day the
 * transcript's rows started asking the server a question
 * ({@link ./declared.ts}). A constant the suite shares belongs in a module
 * that holds a constant, which is what every other shared one already does
 * (`../longPress.ts`, `../edit/draft.ts`'s `IDLE_COMMIT`).
 */
export const NEAR = 64
