/**
 * Carrying a row to a new parent: the picker, its two doors, what it refuses at
 * the aim, and what the directory says afterwards.
 *
 * Its own file for the reason `edge_steps.ts` is one — the picker is a surface
 * with a state of its own (a search, a cursor, a verdict per row) and the rest
 * of the editor's steps are about a line of text. It shares that file's two
 * rules, which are the ones a suite over an asynchronous panel gets wrong:
 *
 *   - A SEARCH is waited for by the query it ANSWERS (`data-asked`), never by
 *     "some rows appeared" — the panel keeps the last query's list standing
 *     while the next is in flight, so a wait for any row is a wait the first
 *     search in a scenario satisfies for the second.
 *   - THE TWO REFUSALS ARE TWO SLOTS. The aim's (`move-refused`, drawn as the
 *     cursor arrives) and the write's (`move-said`, the ops layer's own words)
 *     are different sentences about different moments, and a step that read
 *     either would pass on a client that showed the wrong one.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";

import {
  attr,
  MOVE_HIT,
  MOVE_PICKER,
  MOVE_REFUSED,
  MOVE_SAID,
  MOVE_SEARCH,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { saysThat } from "../support/said.ts";

/** The open picker, waited for. Every step here starts from it, so there is one
 *  spelling of "wait for it" — the edge panel's steps keep the same rule. */
const pickerOf = async (world: OlaiWorld) => {
  const picker = world.page.locator(MOVE_PICKER).first();
  await picker.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  return picker;
};

/** One destination row, by the title a scenario names it with. */
const hitOf = async (world: OlaiWorld, title: string) =>
  (await pickerOf(world)).locator(MOVE_HIT).filter({ hasText: title }).first();

// ── opening it ─────────────────────────────────────────────────────────

Then(
  "the move picker is open on {string}",
  async function (this: OlaiWorld, id: string) {
    const picker = await pickerOf(this);
    assert.strictEqual(
      await picker.getAttribute("data-row"),
      id,
      "the open move picker is about another row",
    );
    // …and it is drawn UNDER that row, which is the whole of "in place": the
    // panel a person is typing in has to be the one hanging off the line they
    // opened it from.
    await this.node(id)
      .locator(MOVE_PICKER)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then("no move picker is open", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(MOVE_PICKER).count()) === 0,
    "the move picker to be gone",
  );
});

// ── choosing a destination ─────────────────────────────────────────────

When(
  "I search the move picker for {string}",
  async function (this: OlaiWorld, text: string) {
    const box = (await pickerOf(this)).locator(MOVE_SEARCH);
    await box.fill(text);
    // The rows of THIS query, by the panel's own answer to "which query are
    // these for" — the edge panel's rule, and the reason it is a rule: a
    // scenario that searches twice would otherwise assert against the first
    // search's list.
    await this.page
      .locator(`${MOVE_PICKER} ${attr("data-asked", text.trim())}`)
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.page
      .locator(MOVE_HIT)
      .first()
      .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  },
);

Then(
  "the move picker offers {string}",
  async function (this: OlaiWorld, title: string) {
    await (await hitOf(this, title)).waitFor({
      state: "visible",
      timeout: POLL_TIMEOUT,
    });
  },
);

/** Put the cursor on a row without taking it — which is what a hover does, and
 *  what makes the aim's refusal a thing a scenario can read one row at a time.
 *  The press below would do it too; this is the half that writes nothing. */
When(
  "I point the move picker at {string}",
  async function (this: OlaiWorld, title: string) {
    await (await hitOf(this, title)).hover();
  },
);

/**
 * Take a destination, and wait for the panel to have carried the write.
 *
 * TWO ENDINGS, exactly as the edge panel's choose has: the picker shuts (a move
 * that landed — the gesture is over, and the row is somewhere else now) or the
 * page says why it did not. A step that only knew the happy one would hang for
 * fifteen seconds on the scenario whose whole point is a refusal.
 *
 * A refused DESTINATION is a third ending and needs no wait at all: nothing was
 * sent, the sentence was already on screen before the press, and the picker
 * stays exactly as it was. `I point the move picker at` is that gesture said
 * out loud; this step is for the ones that expect a write.
 */
When(
  "I choose {string} from the move picker",
  async function (this: OlaiWorld, title: string) {
    await this.press(await hitOf(this, title));
    await this.waitUntil(
      async () =>
        (await this.page.locator(MOVE_SEARCH).count()) === 0 ||
        (await this.page.locator(MOVE_SAID).count()) > 0,
      `the move picker to carry the row under ${JSON.stringify(title)}, ` +
        "or the page to say why it did not",
    );
    // ONE MORE FRAME on the happy path, which is what the edge panel's own
    // receipt is about: the row being redrawn is the SNAPSHOT, and the reply
    // this tab files its undo on is the next message on the same wire. Without
    // it a ⌘Z straight afterwards spends a stack that is still empty.
    if ((await this.page.locator(MOVE_SAID).count()) === 0) {
      await this.waitForFrame();
    }
  },
);

// ── what it refuses, at the aim ────────────────────────────────────────

/** The sentence drawn about the destination the cursor is on. `toContain`
 *  rather than an equality, because these sentences NAME things — a title, two
 *  files — and a scenario should quote the clause it is about. */
Then(
  "the move picker refuses with {string}",
  async function (this: OlaiWorld, said: string) {
    const line = (await pickerOf(this)).locator(MOVE_REFUSED).first();
    await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await this.waitUntil(
      async () => (await line.innerText()).includes(said),
      `the picker's refusal to say ${JSON.stringify(said)}`,
    ).catch(async () => {
      assert.ok(
        (await line.innerText()).includes(said),
        `the picker's refusal reads: ${await line.innerText()}`,
      );
    });
  },
);

Then("the move picker refuses nothing", async function (this: OlaiWorld) {
  const picker = await pickerOf(this);
  await this.waitUntil(
    async () => (await picker.locator(MOVE_REFUSED).count()) === 0,
    "the picker to draw no refusal about the row the cursor is on",
  );
});

/** The DIM on a row, which is the same verdict said where a reader scanning the
 *  list can see it — the half the sentence under the list cannot do for eight
 *  rows at once. */
Then(
  "the move picker draws {string} as refused",
  async function (this: OlaiWorld, title: string) {
    const row = (await pickerOf(this))
      .locator("li")
      .filter({ has: this.page.locator(MOVE_HIT).filter({ hasText: title }) })
      .first();
    assert.strictEqual(
      await row.getAttribute("data-refused"),
      "true",
      `${JSON.stringify(title)} is not drawn as a refused destination`,
    );
  },
);

// ── and what a write said ──────────────────────────────────────────────

/**
 * The ops layer's own remark about a move that LANDED — never the aim's line
 * above, and never a refusal: the two moods are `data-tone` apart and this one
 * asserts the quiet one.
 *
 * It is drawn under the row in its NEW home, which is the whole reason the said
 * line outlives the panel that sent the write (`client/move/moving.tsx`): a
 * nudge keyed to where the row used to be would vanish with the frame that
 * moved it.
 */
Then(
  "the move noted {string}",
  async function (this: OlaiWorld, said: string) {
    await saysThat(this, MOVE_SAID, said, "the move's said line", "aside");
  },
);
