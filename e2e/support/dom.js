// Assertions about an element that playwright has no spelling for. Here
// rather than in whichever step file needed one first: a step file is about a
// surface of the app, and reaching into another one for a helper couples two
// surfaces that have nothing to say to each other.

import assert from "node:assert/strict";

/** Whether an element wears a class the app puts on it to mean a STATE
 *  (is-done, is-collapsed). Read directly rather than through what it paints:
 *  the paint is one of several ways the state draws, and the cheapest one to
 *  change. */
export async function hasClass(locator, cls) {
  await locator.waitFor();
  return await locator.evaluate((el, c) => el.classList.contains(c), cls);
}

export async function assertClass(locator, cls, want, what) {
  assert.equal(
    await hasClass(locator, cls),
    want,
    `${what}: expected .${cls} to be ${want}`,
  );
}

/** A literal, as a regexp. innerText carries whatever the markup put around
 *  it, so a step that means "this text is in there" says so with a match. */
export function literal(s) {
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}
