// The note's fold: how tall the box is, whether anything is being cut off by
// it, and the clicks that do and do not change that.
//
// "Folded" is asked of the ELEMENT — the box being shorter than what is in it
// — because that is what a reader sees; the class and the ARIA state are
// asserted beside it, the way collapse_steps does, so a fold that stopped
// saying what it is to a screen reader fails here too.
//
// The clicks are POSITIONED rather than aimed at the middle of the element:
// the note is the target now, and which part of it was hit is the whole
// question in three of these scenarios (its text, the empty end of its line,
// the link on a line the fold hides).
//
// A note is addressed through the node it belongs to, like every other part of
// a node in this suite.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

import { hasClass } from "../support/dom.js";

// The note block of a node's OWN row: a descendant's is another node's.
function block(world, title) {
  return world
    .node(title)
    .first()
    .locator(":scope > .ol-row .ol-note-block")
    .first();
}

// The same node drawn at a second site, under the node it hangs from.
function mirrorBlock(world, parent) {
  return world
    .node(parent)
    .first()
    .locator(".ol-node")
    .filter({ has: world.page.locator(".ol-mirror") })
    .first()
    .locator(":scope > .ol-row .ol-note-block")
    .first();
}

const text = (blk) => blk.locator(".ol-note").first();
const button = (blk) => blk.locator(".ol-note-more").first();

/** Whether the fold is cutting anything off, in one round trip. Nothing here
 *  measures a line height: what "one line" is belongs to the stylesheet, and
 *  the question a reader asks is only whether there is more than is showing. */
async function clipped(blk) {
  const note = text(blk);
  await note.waitFor();
  return await note.evaluate((n) => n.scrollHeight > n.clientHeight + 1);
}

/** Wait until notes.js has had its pass over this page.
 *
 *  Everything about a note that can be pressed is drawn from a MEASUREMENT, so
 *  before that pass every note looks like a note with nothing to open — which
 *  is exactly what half these steps assert. The fixture guarantees one note
 *  that does have more in it, so its .has-more arriving is the honest signal
 *  that the pass has happened. */
async function measured(world) {
  await world.page.locator(".ol-note-block.has-more").first().waitFor();
}

// ---- what the fold is doing ------------------------------------------------

Then("the note under {string} is folded", async function (title) {
  await assertFolded(block(this, title), true, title);
});

Then("the mirrored note under {string} is folded", async function (parent) {
  await assertFolded(mirrorBlock(this, parent), true, `the mirror under ${parent}`);
});

// Nothing cut off. For the note that is already one line this is the whole
// assertion: nothing was ever hidden, so there is nothing to open.
Then("the note under {string} shows all of it", async function (title) {
  assert.equal(
    await clipped(block(this, title)),
    false,
    `${title}: the note is still cutting itself off`,
  );
});

// The point of a fold that is a BOX: folded or not, the text is in the page,
// so find-in-page finds it and a morph has it to compare against.
Then("the note under {string} still says {string}", async function (title, said) {
  const blk = block(this, title);
  assert.equal(await clipped(blk), true, `${title}: the note is not folded`);
  const all = await text(blk).textContent();
  assert.ok(all.includes(said), `${title}: the folded note has lost "${said}"`);
});

// ---- what a note with more in it offers ------------------------------------
//
// Not "is the button visible": the button is out of sight on purpose, and the
// cue a reader sees is the ellipsis the clamp draws, which no assertion can
// point at. What CAN be asked is whether this note is a control at all — the
// state that draws the ellipsis, arms the click and puts the button in reach
// is one class, and the button being reachable is one computed style.

Then("the note under {string} offers to open", async function (title) {
  await measured(this);
  const blk = block(this, title);
  assert.equal(
    await hasClass(blk, "has-more"),
    true,
    `${title}: the note has more in it than it is showing and does not say so`,
  );
  assert.notEqual(
    await display(button(blk)),
    "none",
    `${title}: there is more to show and no way for a keyboard to ask for it`,
  );
});

Then("the note under {string} offers nothing to open", async function (title) {
  await measured(this);
  const blk = block(this, title);
  assert.equal(
    await hasClass(blk, "has-more"),
    false,
    `${title}: a note that fits on its line is offering to open`,
  );
  assert.equal(
    await display(button(blk)),
    "none",
    `${title}: a note with nothing to open is still a tab stop`,
  );
});

// ---- pressing it -----------------------------------------------------------

// The note's own text, at the start of its first line: never the empty end of
// the line, and never the link further down it — those are the two scenarios
// after this one.
When("I click the note under {string}", async function (title) {
  await measured(this);
  await text(block(this, title)).click({ position: { x: 8, y: 5 } });
});

// Past where the text stops, on the same line. The whole line is the target,
// which is the half of this feature the button at the column's edge was not.
When("I click the end of the folded line under {string}", async function (title) {
  await measured(this);
  const note = text(block(this, title));
  const box = await note.boundingBox();
  await note.click({ position: { x: box.width - 8, y: 5 } });
});

// A pointer that is only passing through. The step exists to be followed by an
// assertion that nothing happened.
When("I point at the note under {string}", async function (title) {
  await measured(this);
  await text(block(this, title)).hover();
});

// A link in a note is a link: the click follows it and the note is not folded
// by the same press. It points inside this page, so nothing navigates — the
// address is the assertion.
When("I follow the link inside the note under {string}", async function (title) {
  await text(block(this, title)).locator("a").first().click();
});

Then("the address ends with {string}", async function (suffix) {
  await this.page.waitForURL((url) => url.toString().endsWith(suffix));
});

// A real drag across the note's text, because that is what makes a selection —
// and the mouseup that ends it is the click that must not fold anything.
When("I select some text in the note under {string}", async function (title) {
  const box = await text(block(this, title)).boundingBox();
  await this.page.mouse.move(box.x + 8, box.y + 6);
  await this.page.mouse.down();
  await this.page.mouse.move(box.x + box.width / 2, box.y + 6, { steps: 12 });
  await this.page.mouse.up();
});

Then("some text is selected", async function () {
  const selected = await this.page.evaluate(() =>
    window.getSelection().toString().trim(),
  );
  assert.ok(selected.length > 0, "nothing was selected: the drag did not take");
});

// ---- the keyboard's door ---------------------------------------------------

When("I focus the note's button under {string}", async function (title) {
  await measured(this);
  await button(block(this, title)).focus();
});

// Focused, it is a chip you can see — a control the keyboard lands on and the
// mouse never has to find. Its width is what says so: out of focus it is the
// clipped 1px box that keeps it off the screen and in the tab order.
Then("the note's button under {string} is visible", async function (title) {
  const box = await button(block(this, title)).boundingBox();
  assert.ok(
    box && box.width > 4,
    `${title}: the focused button is still the hidden one`,
  );
});

Then(
  "the note's button under {string} says it is expanded",
  async function (title) {
    assert.equal(
      await button(block(this, title)).getAttribute("aria-expanded"),
      "true",
      `${title}: aria-expanded disagrees with the note`,
    );
  },
);

When("I press Enter", async function () {
  await this.page.keyboard.press("Enter");
});

// ---- helpers ---------------------------------------------------------------

function display(locator) {
  return locator.evaluate((el) => getComputedStyle(el).display);
}

async function assertFolded(blk, want, what) {
  assert.equal(await clipped(blk), want, `${what}: the fold is the wrong way round`);
  assert.equal(
    await hasClass(blk, "is-expanded"),
    !want,
    `${what}: the class disagrees with what is on screen`,
  );
  assert.equal(
    await button(blk).getAttribute("aria-expanded"),
    want ? "false" : "true",
    `${what}: aria-expanded disagrees with the fold`,
  );
}
