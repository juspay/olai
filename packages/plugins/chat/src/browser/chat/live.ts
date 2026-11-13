/**
 * The panel's one cue for *this is happening right now*.
 *
 * A small dot in the doing colour, pulsing. Two places wear it and they are
 * the same fact one level apart — the header says a TURN is in flight, and a
 * spawn's rail says an AGENT the turn sent out is ({@link ./Transcript.tsx}) —
 * so a reader who has learned one has learned the other, and a panel that drew
 * them differently would be asking to be taught the same thing twice.
 *
 * One spelling, in the arrangement this client already uses for a shape whose
 * whole value is being one shape ({@link ../pill.ts}, {@link ../readout.ts}'s
 * `DOT`): a constant, a reason, and a sweep in `../claims.test.ts` so the third
 * site that needs a live cue imports this rather than retyping it. Without
 * that sweep the two copies agreed only by coincidence, with a comment in one
 * of them asserting they did.
 *
 * What is NOT here is the line it sits on. The header's is `text-doing` at the
 * chrome's own scale and the rail's is mono at the transcript's, and that
 * divergence is deliberate: each belongs to the type around it, and converging
 * them would move pixels rather than unify a spelling — the distinction
 * `../pill.ts` already draws for its own lookalikes.
 *
 * WHAT IT SAYS WHEN IT HOLDS STILL. A reader who asks their system for less
 * motion gets a dot that does not pulse (`@olai/appearance/chrome.css` says so
 * once, for the whole app) — and loses nothing by it, because the pulse was
 * never the news. The dot is DRAWN only while something is in flight: every
 * one of the four sites hangs it off a `Show` over a live state, so its
 * presence is the cue and the movement was only ever the flourish. The agent
 * standings had the opposite arrangement and had to be fixed
 * (`../agents/roster.ts`); this one was right by construction, which is worth
 * writing down before somebody "helpfully" draws a grey dot for idle.
 */
export const LIVE_DOT = "inline-block size-1.5 animate-pulse rounded-full bg-doing"
