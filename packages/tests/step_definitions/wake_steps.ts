/**
 * THE SECOND DOORBELL, through the browser — the control a person points, and
 * the sentence that arrives because they pointed it.
 *
 * Everything about WHAT is claimed, what a wake MEANS, and what the sentence
 * says is a pure function over a parsed vault and has its own unit tests
 * (`@olai/plugin-kolu`'s `doorbell.test.ts`); so are the three arms of the
 * delivery itself (`@olai/chat`'s `deliveries.test.ts`). Nothing here re-asserts
 * any of that. What these steps are about is the half that only a real browser
 * and a real server can say: a person picks a file, a watcher on the far end of
 * a real socket fires, and a message nobody typed appears in the transcript
 * wearing a face that is not theirs — with the composer they were typing in
 * untouched.
 *
 * ## THE RING IS A GESTURE, NOT A CLOCK
 *
 * `held-for` is a debounce before a held terminal is reported, and the watcher
 * re-arms a standing hold when the knob MOVES DOWN (`@olai/kolu-client`'s
 * `watch.ts`). So the scenario lowers it and the fire is immediate and caused —
 * rather than setting a small interval at boot and waiting one out, which is the
 * shape that goes green on a laptop and red on a loaded box.
 *
 * The DOM is reached through `../support/world.ts`'s named constants only, which
 * are built from the client's own `TESTID` record: a rename over there is a type
 * error here rather than a timeout.
 */

import * as assert from "node:assert";
import { Then, When } from "@cucumber/cucumber";
import type { Locator } from "playwright";

import {
  attr,
  CHAT_ENTRY,
  CHAT_MINE,
  CHAT_PLUGIN_MARK,
  CHAT_RANG,
  CHAT_RANG_BODY,
  CHAT_RANG_BYLINE,
  CHAT_RANG_FOLD,
  CHAT_RESEND,
  CHAT_INPUT,
  CHAT_WAKE,
  CHAT_WAKE_FILE,
  CHAT_WAKE_PICKER,
  CHAT_WAKE_QUERY,
  NODE_REF_ANY,
  POLL_TIMEOUT,
} from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the control ────────────────────────────────────────────────────────

/**
 * THE ONE DOORBELL ON THIS CONVERSATION.
 *
 * The strip draws a line per running plugin that declares a wake, and today
 * exactly one does. Asserting that here rather than reaching for `.first()` is
 * the difference between a step that keeps being about kolu's doorbell and one
 * that quietly starts asserting about whichever plugin grew a second: the count
 * is part of what the scenario means, so a second row fails loudly and names the
 * fix instead of passing against the wrong row.
 */
const theOnlyPicker = async (world: OlaiWorld): Promise<Locator> => {
  const strip = world.page.locator(CHAT_WAKE);
  await strip.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const pickers = world.page.locator(CHAT_WAKE_PICKER);
  const drawn = await pickers.count();
  assert.strictEqual(
    drawn,
    1,
    "this scenario is written against a conversation with one doorbell on it. " +
      "A second plugin declaring a wake is not a failure of the feature — it " +
      "means this step has to say WHOSE doorbell it is pointing.",
  );
  return pickers.first();
};

/** What that control is pointed at, as data: a path, or the word `off`. The
 *  words around it are the plugin's own sentence, and a scenario asserting
 *  those would be asserting somebody else's vocabulary. */
const pointedAt = async (world: OlaiWorld, expected: string): Promise<void> => {
  await world.expectAttribute(
    CHAT_WAKE_PICKER,
    "data-file",
    expected,
    "this conversation's wake control",
  );
};

/** The ruling's own default, drawn rather than hidden: nobody is opted in by a
 *  serve, so a fresh conversation says `off` and offers the way to change it. */
Then("this conversation wakes on nothing", async function (this: OlaiWorld) {
  await theOnlyPicker(this);
  await pointedAt(this, "off");
});

/**
 * PICK A FILE, the way a person does: open the list, narrow it, press the row.
 *
 * Through the FILTER BOX and not by pressing whichever row happens to be drawn
 * — a served directory is thousands of files and the list offers twelve, so a
 * scenario that did not type would be asserting about the matcher's ranking
 * rather than about the pick.
 */
When(
  "I point this conversation's wake at {string}",
  async function (this: OlaiWorld, file: string) {
    await this.press(await theOnlyPicker(this));
    const query = this.page.locator(CHAT_WAKE_QUERY);
    await query.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
    await query.fill(file);
    await this.press(this.page.locator(`${CHAT_WAKE_FILE}${attr("data-file", file)}`));
  },
);

/** ... and that it stuck. The value comes back off the chat cell — the server
 *  wrote it, published it, and this tab redrew from that — so this is the round
 *  trip and not the press's own optimism. */
Then(
  "this conversation wakes on {string}",
  async function (this: OlaiWorld, file: string) {
    await pointedAt(this, file);
  },
);

// ── the far end ────────────────────────────────────────────────────────

/**
 * MAKE THE WATCHER SPEAK NOW.
 *
 * `_olai/Kolu.olai` is the file that paces the watch, and `held-for` is how long
 * a terminal must sit in a state before it is worth saying anything about. The
 * fixture's fleet already holds one — `review: grok`'s terminal, which padi says
 * is blocked on a person — so lowering the debounce re-arms that standing hold
 * and it fires at once (`@olai/kolu-client`'s `watch.ts`: "a LOWERED `held-for`
 * fires at once").
 *
 * `0s` and not `1s`, because a second is a race: the assertion after this step
 * would be waiting on a timer rather than on a consequence, and a step that
 * waits out a clock is the first thing to fail on a box that is busy. padi's own
 * grammar admits `0` here for exactly this reason — the instant report — and the
 * two knobs that would spin at zero are left alone.
 */
When("the watch is told to report a held terminal at once", function (this: OlaiWorld) {
  this.writeServed(
    "_olai/Kolu.olai",
    `{"id":"watch","ord":"a0","title":"watch","custom":{"held-for":"0s"}}`,
  );
});

// ── what arrives ───────────────────────────────────────────────────────

/** THE MACHINE'S ROW — the `user` entry whose words a plugin put there. */
const rungRow = (world: OlaiWorld): Locator =>
  world.page.locator(CHAT_ENTRY).filter({ has: world.page.locator(CHAT_RANG) });


/**
 * ONE LINE, AND THE REST BEHIND A PRESS — the fold, asserted without asserting
 * a word the plugin wrote.
 *
 * The body's testid is ABSENT from the page while the row is folded (a `<Show>`
 * and not a `hidden`), which is what makes this a claim about the fold rather
 * than about CSS: a row painted away is one a screen reader still walks, and a
 * step that asked about visibility could not tell the two apart.
 */


/**
 * IT IS KOLU'S OWN LOGO, and that is a stronger claim than "kolu contributed a
 * mark" — which is why this asserts a GRADIENT rather than the `data-mark`
 * attribute.
 *
 * `data-mark="kolu"` was already true of the hand-drawn glyph this replaced:
 * two abstract panes in `currentColor`, invented in olai because inventing one
 * was easy. A scenario asserting the attribute would have passed against the
 * very defect the human found by looking. The pinned asset is three rainbow
 * bars built out of `<linearGradient>`s, and a drawn approximation has none —
 * so the gradient is the cheapest thing on the page that can only be there if
 * the bytes really came from kolu's own `favicon.svg` through the pin.
 */
Then(
  "that sentence wears {string}'s own logo",
  async function (this: OlaiWorld, plugin: string) {
    // NOT INSIDE THE ROW. A mark sits on the strip that opens a speaker's RUN,
    // above the first of their messages and beside none of the rest — the
    // group-level rule the transcript keeps for all three faces. So it is found
    // by the name it stamps rather than by walking up from the row.
    const mark = this.page.locator(`${CHAT_PLUGIN_MARK}${attr("data-mark", plugin)}`);
    await this.waitUntil(
      async () => (await mark.locator("linearGradient").count()) >= 1,
      "the machine's row to wear a mark built from the pinned brand asset",
    );
    assert.equal(
      await mark.count(),
      1,
      `no mark stamped ${plugin} — the panel fell back to its generic glyph, so the ` +
        "plugin's own never reached it",
    );
  },
);
/**
 * THE COLLAPSED LINE IS PRESSABLE, which is the half a fold could have taken
 * away.
 *
 * The account behind the fold names every claim with its own reference, and
 * that was where the link lived first — behind the very fold it was the reason
 * to open. Asserted on the HEAD, before anything is pressed, and asserted as
 * "a reference is here" rather than as an id: which node the board claims from
 * is the fixture's business, and a scenario that spelled it would be asserting
 * the plugin's derivation rather than the panel's promise.
 */
Then(
  "that sentence can be pressed through to the board",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () =>
        (await rungRow(this).first().locator(`${CHAT_RANG_BYLINE} ${NODE_REF_ANY}`).count()) >= 1,
      "the machine's head line to carry a pressable node reference",
    );
  },
);
Then(
  "that sentence is one line, with its account folded away",
  async function (this: OlaiWorld) {
    await this.waitUntil(
      async () => (await rungRow(this).first().locator(CHAT_RANG_FOLD).count()) === 1,
      "the machine's row to draw a fold control",
    );
    assert.equal(
      await rungRow(this).first().locator(CHAT_RANG_BODY).count(),
      0,
      "a machine's row draws its account before anybody asked for it",
    );
  },
);

When("I open that sentence", async function (this: OlaiWorld) {
  await rungRow(this).first().locator(CHAT_RANG_FOLD).click();
  await this.waitUntil(
    async () => (await rungRow(this).first().locator(CHAT_RANG_BODY).count()) === 1,
    "the machine's account to come out of the fold",
  );
});
Then("the chat shows a sentence no person typed", async function (this: OlaiWorld) {
  await this.page
    .locator(CHAT_RANG)
    .first()
    .waitFor({ state: "visible", timeout: POLL_TIMEOUT });
});

/** WHOSE doorbell it was, as data. The row carries the name core stamped off
 *  its own registry binding, never a word the plugin asserted about itself —
 *  which is what keeps one plugin from signing another's sentence. */
Then(
  "that sentence was rung by {string}",
  async function (this: OlaiWorld, plugin: string) {
    await this.expectAttribute(
      CHAT_RANG,
      "data-rang-by",
      plugin,
      "the machine's message",
    );
  },
);

/**
 * ... and that it is about the terminal the board claims.
 *
 * The id is asserted and not the wording: every word of the sentence is the
 * plugin's own and `doorbell.test.ts` pins them. What this claim is for is the
 * JOIN — the file a person picked, the un-done step in it, and a terminal on the
 * far end of a real socket are three separate facts, and this is the one place
 * they meet.
 */
Then(
  "that sentence names the terminal {string}",
  async function (this: OlaiWorld, terminal: string) {
    await this.waitUntil(
      async () => ((await rungRow(this).first().textContent()) ?? "").includes(terminal),
      `the machine's message to name the terminal ${terminal}`,
    );
  },
);

/**
 * IT IS NOT DRAWN AS MINE, and that is the whole of the face.
 *
 * A delivered sentence travels down the human's lane because that is the lane a
 * prompt goes out on — so it lands in a `user` row, and the one thing that must
 * not follow is its looking like one. `chatMine` is the human bubble alone: a
 * scenario elsewhere asking "did I say this" must never be handed a plugin's
 * words, and this is the step that keeps that true.
 */
Then("that sentence is not one of my own messages", async function (this: OlaiWorld) {
  assert.strictEqual(
    await rungRow(this).locator(CHAT_MINE).count(),
    0,
    "the machine's sentence was drawn as the person's own message",
  );
});

/**
 * AND IT OFFERS NO WAY TO SEND IT AGAIN.
 *
 * A doorbell body is a derivation of how something STOOD when it rang. Sending
 * it again later re-sends a claim that has stopped being true — and the thing
 * that derived it rings again by itself, so there is nothing a person gains by
 * the button and something they can be misled by.
 */
Then("that sentence offers no way to send it again", async function (this: OlaiWorld) {
  assert.strictEqual(
    await rungRow(this).locator(CHAT_RESEND).count(),
    0,
    "the machine's sentence offered a *send again*, which would re-send a " +
      "claim about a moment that has passed",
  );
});

/**
 * THE COMPOSER NEVER MOVED.
 *
 * The delivery rides the same wire a send rides and deliberately not the
 * composer path — so a half-typed thought is still exactly a half-typed thought
 * after a plugin has spoken into the same conversation. HELD rather than waited
 * for: the claim is that nothing happened to these words, and a poll that
 * stopped at the first true reading would pass before the delivery landed.
 */
Then(
  "the chat input still holds {string}",
  async function (this: OlaiWorld, text: string) {
    const input = this.page.locator(CHAT_INPUT);
    for (let look = 0; look < 5; look += 1) {
      assert.strictEqual(
        await input.inputValue(),
        text,
        "the machine's message changed what was in the composer",
      );
      await this.page.waitForTimeout(100);
    }
  },
);
