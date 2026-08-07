// The note's fold: how tall the box is, whether anything is being cut off by
// it, and the button that decides.
//
// "Folded" is asked of the ELEMENT — the box being shorter than what is in it
// — because that is what a reader sees; the class and the ARIA state are
// asserted beside it, the way collapse_steps does, so a fold that stopped
// saying what it is to a screen reader fails here too.
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

/** Whether the fold is cutting anything off, in one round trip. Nothing here
 *  measures a line height: what "one line" is belongs to the stylesheet, and
 *  the question a reader asks is only whether there is more than is showing. */
async function clipped(blk) {
  const note = blk.locator(".ol-note").first();
  await note.waitFor();
  return await note.evaluate((n) => n.scrollHeight > n.clientHeight + 1);
}

/** Wait until notes.js has had its pass over this page.
 *
 *  The button is drawn from a MEASUREMENT, so before that pass every note
 *  looks like a note with nothing to open — which is exactly what half these
 *  steps assert. The fixture guarantees one note that does have more in it, so
 *  its button appearing is the honest signal that the pass has happened. */
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
Then("the note under {string} still says {string}", async function (title, text) {
  const blk = block(this, title);
  assert.equal(await clipped(blk), true, `${title}: the note is not folded`);
  const said = await blk.locator(".ol-note").first().textContent();
  assert.ok(said.includes(text), `${title}: the folded note has lost "${text}"`);
});

// ---- the affordance --------------------------------------------------------

Then("the note under {string} offers to open", async function (title) {
  await button(block(this, title)).waitFor({ state: "visible" });
});

Then("the note under {string} offers nothing to open", async function (title) {
  await measured(this);
  assert.equal(
    await button(block(this, title)).isVisible(),
    false,
    `${title}: a note that fits on its line is offering to open`,
  );
});

// ---- opening and folding ---------------------------------------------------

When("I open the note under {string}", async function (title) {
  await setOpen(this, block(this, title), true);
});

When("I fold the note under {string}", async function (title) {
  await setOpen(this, block(this, title), false);
});

// The button and nothing else. Named as a tap because the scenario that uses
// it runs on a phone screen, where it is the whole of the interaction.
When("I tap the note's button under {string}", async function (title) {
  await measured(this);
  await button(block(this, title)).click();
});

// A pointer that is only passing through. The step exists to be followed by an
// assertion that nothing happened.
When("I point at the note under {string}", async function (title) {
  await measured(this);
  await block(this, title).locator(".ol-note").first().hover();
});

// ---- helpers ---------------------------------------------------------------

function button(blk) {
  return blk.locator(".ol-note-more").first();
}

/** Press the button only when it is pointing the wrong way: it is a toggle, so
 *  a step that always clicked would mean "open" or "fold" by luck. */
async function setOpen(world, blk, want) {
  await measured(world);
  if ((await hasClass(blk, "is-expanded")) === want) return;
  await button(blk).click();
}

async function assertFolded(blk, want, what) {
  assert.equal(await clipped(blk), want, `${what}: the fold is the wrong way round`);
  assert.equal(
    await hasClass(blk, "is-expanded"),
    !want,
    `${what}: the class disagrees with what is on screen`,
  );
  const btn = button(blk);
  if (await btn.isVisible()) {
    assert.equal(
      await btn.getAttribute("aria-expanded"),
      want ? "false" : "true",
      `${what}: aria-expanded disagrees with the fold`,
    );
  }
}
