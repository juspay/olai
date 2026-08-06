// The note's fold: how tall the box is, and whether anything is being cut off
// by it.
//
// Both questions are asked of the ELEMENT rather than of a class, because
// there is no class to ask — the fold is CSS over a hover and a focus
// (web/node), and nothing writes any state down. So "folded" is the box being
// shorter than what is in it, and "open" is it no longer being so.
//
// A note is addressed through the node it belongs to, like every other part of
// a node in this suite.

import assert from "node:assert/strict";
import { Then, When } from "@cucumber/cucumber";

// The note of a node's OWN row: a descendant's is another node's.
function note(world, title) {
  return world.node(title).first().locator(":scope > .ol-row .ol-note").first();
}

/** How the box and its contents measure up, in one round trip: whether the
 *  box is cutting anything off, and how many lines tall it is. The line count
 *  is a ratio and not a pixel count — the note's own line-height is what a
 *  line IS, and a rounded font metric would make an assertion about type
 *  sizes out of an assertion about a fold. */
async function measure(el) {
  await el.waitFor();
  return await el.evaluate((n) => {
    const lineHeight = parseFloat(getComputedStyle(n).lineHeight);
    return {
      clipped: n.scrollHeight > n.clientHeight + 1,
      lines: n.clientHeight / lineHeight,
      text: n.textContent,
    };
  });
}

// One line tall AND cutting something off: a box that is one line tall
// because that is all there is would pass half of this and mean the opposite.
// The line count is generous on purpose — a note's first block carries a
// margin, so one line of text is a little more than one line-height of box,
// and two lines are a great deal more than this.
Then("the note under {string} is folded to one line", async function (title) {
  const m = await measure(note(this, title));
  assert.ok(m.clipped, `${title}: the note is showing everything it has`);
  assert.ok(
    m.lines < 1.75,
    `${title}: the note is ${m.lines.toFixed(2)} lines tall, not one`,
  );
});

Then("the note under {string} is one line tall", async function (title) {
  const m = await measure(note(this, title));
  assert.ok(
    m.lines < 1.75,
    `${title}: the note is ${m.lines.toFixed(2)} lines tall, not one`,
  );
});

// Nothing cut off. For the note that is already one line this is the whole
// assertion: there is no ellipsis, because there is nothing to ellipsize.
Then("the note under {string} shows all of it", async function (title) {
  const m = await measure(note(this, title));
  assert.ok(!m.clipped, `${title}: the note is still cutting itself off`);
});

// The point of a fold that is a BOX: folded or not, the text is in the page,
// so find-in-page finds it and a morph has it to compare against.
Then("the note under {string} still says {string}", async function (title, text) {
  const m = await measure(note(this, title));
  assert.ok(m.clipped, `${title}: the note is not folded, so this proves nothing`);
  assert.ok(
    m.text.includes(text),
    `${title}: the folded note has lost "${text}"`,
  );
});

// ---- the two ways to open one ----------------------------------------------

// The pointer goes on the node's own TITLE: anywhere in the node opens it, and
// the title is the part of it every node has.
When("I point at {string}", async function (title) {
  await this.node(title)
    .first()
    .locator(":scope > .ol-row .ol-title")
    .first()
    .hover();
});

// Off every node, without leaving the page: the top-left corner is the
// sidebar's, which has no notes in it.
When("I point away", async function () {
  await this.page.mouse.move(0, 0);
});

When("I tap the note under {string}", async function (title) {
  await note(this, title).click();
});
