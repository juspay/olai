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
  MOVE_CLOSE,
  MOVE_HIT,
  MOVE_PICKER,
  MOVE_REFUSED,
  MOVE_SAID,
  MOVE_SEARCH,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
import { saysThat } from "../support/said.ts";
import { answering } from "../support/shortlist.ts";

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
    // these for" — `../support/shortlist.ts`, which is that wait for every
    // panel in this suite that searches, and the reason it is one place: a
    // scenario that searches twice would otherwise assert against the first
    // search's list, and two spellings of the wait is one of them stopping.
    await answering(this, MOVE_PICKER, MOVE_HIT, text);
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

// ── and what the gesture cost the wire ─────────────────────────────────

/**
 * The wire tag the picker's one subscription is opened at — `<member>/<verb>`,
 * which is how kolu addresses every member of a surface (`surfaceTag`: the
 * whole tag is `<prefix><member>/<verb>`, and the prefix is left off so this is
 * a substring of whichever composed surface serves it).
 *
 * Counting frames rather than reading the DOM, because what these two claims
 * are about is not on screen at all: a panel that re-asks a question it is
 * already watching, and a spent gesture that never stops watching, both draw
 * exactly what a correct client draws.
 */
const MOVING = "moving/get";

Then(
  "the tab has asked to judge this move {int} time(s)",
  function (this: OlaiWorld, times: number) {
    assert.strictEqual(
      this.socketAskedSince(MOVING),
      times,
      "how many times this tab opened the move subscription since the mark",
    );
  },
);

/**
 * …and what a question was ABOUT, which the count above cannot say: the
 * destinations ride the request, so a tag plus an id is "this tab asked the set
 * to judge this move against that row".
 *
 * A NEGATIVE, because what it is for is a panel asking about rows nobody is
 * showing: the shortlist hands its own list up when it MOUNTS, which is after
 * the picker opens, so a picker whose destinations were not put down opens by
 * asking about the last one's — a verdict about a list that is off the screen,
 * and a round trip spent on it.
 */
Then(
  "the tab has never asked to judge a move against {string}",
  function (this: OlaiWorld, id: string) {
    assert.strictEqual(
      this.socketAskedSince(MOVING, id),
      0,
      `this tab asked the set to judge a move against ${JSON.stringify(id)}, ` +
        "which is a destination no open list is showing",
    );
  },
);

/**
 * …and the other half of the same claim, read off what ARRIVED: a subscription
 * nobody let go of goes on being answered, and that answer is the only trace it
 * leaves — nothing is drawn from it, and nothing is asked for it again.
 *
 * TWO PROBES, because either alone is a substring of frames about other things:
 * `refusals` is the answer's own field (`@olai/format`'s `MovingAnswer`; a
 * search answer carries one too), and the record is what this answer is about.
 * Together they name a verdict about this row and nothing else.
 */
Then(
  "the set has said nothing more about moving {string}",
  function (this: OlaiWorld, record: string) {
    assert.strictEqual(
      this.socketSaidSince("refusals", record),
      0,
      "the set answered about this move after the gesture was over, which is " +
        "a subscription nobody closed",
    );
  },
);

/**
 * Wait out the sentence a landed move left standing.
 *
 * The line takes itself away after `SAID_MS` (`client/saying.ts`), and what
 * that moment IS for this gesture is the whole of the claim around it: nothing
 * of the move is on screen any more, so nothing of it should be on the wire
 * either. The budget is the poll's, which is comfortably longer than the six
 * seconds — a step that spelled the six would be the client's constant written
 * down twice.
 */
When("the move's sentence has gone", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(MOVE_SAID).count()) === 0,
    "the move's said line to take itself away",
  );
});
