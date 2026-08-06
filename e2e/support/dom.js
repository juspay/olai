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

// An expando on a DOM node. It dies with the element and with nothing else,
// which makes it the only honest answer to "is this still the same element" —
// a question the live view exists to make answerable with yes.
const NODE_MARK = "__olai_e2e_node";

/** Mark the element this locator resolves to. */
export async function markElement(locator) {
  await locator.evaluate((el, k) => {
    el[k] = true;
  }, NODE_MARK);
}

/** Whether the element this locator resolves to is the one that was marked —
 *  not one that looks like it. */
export async function isMarkedElement(locator) {
  return await locator.evaluate((el, k) => el[k] === true, NODE_MARK);
}

/** A string, as regexp source: every metacharacter escaped, backslash first
 *  among them. For building a pattern that has a literal PART — a filename, a
 *  title — and a real pattern around it. */
export function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A literal, as a regexp. innerText carries whatever the markup put around
 *  it, so a step that means "this text is in there" says so with a match. */
export function literal(s) {
  return new RegExp(escapeRx(s));
}
