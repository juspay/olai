/**
 * ⌘Z and ⌘⇧Z: what the outline says afterwards, and what the page said about
 * it.
 *
 * The keys themselves need no step of their own — they are chords, and
 * `editing_steps.ts` already presses keys by Playwright's own name. What is
 * here is the one surface an undo has that no other write does: it is pressed
 * with no draft open, so what it has to say is drawn over the page rather than
 * under a row, and a scenario has to be able to read it.
 *
 * The rest of the assertions in `undo.feature` are deliberately the SAME steps
 * the keyboard feature uses — "is a child of", "comes before", "has status",
 * "holds a node titled". An undo is one more op through the same gate, so what
 * it did is asked the same way anything else's write is; a private vocabulary
 * for it would be a claim that it is a different kind of thing.
 */

import * as assert from "node:assert";

import { Then, When } from "@cucumber/cucumber";

import { POLL_TIMEOUT, UNDO_SAID } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

/** What the line over the page reads, once there is one. Both moods go through
 *  here — a refusal and a remark are the same assertion about two tones, and
 *  the TONE is what tells them apart (`data-tone`, never the colour). */
const undoSaid = async (
  world: OlaiWorld,
  said: string,
  tone: "alarm" | "aside",
): Promise<void> => {
  const line = world.page.locator(UNDO_SAID).first();
  await line.waitFor({ state: "visible", timeout: POLL_TIMEOUT });
  const text = (await line.innerText()).trim();
  assert.ok(
    text.includes(said),
    `the undo line reads ${JSON.stringify(text)}, which does not mention ${
      JSON.stringify(said)
    }`,
  );
  assert.strictEqual(
    await line.getAttribute("data-tone"),
    tone,
    `the undo line says ${JSON.stringify(text)} in the wrong tone`,
  );
};

Then("the undo says {string}", async function (this: OlaiWorld, said: string) {
  await undoSaid(this, said, "aside");
});

Then(
  "the undo refusal says {string}",
  async function (this: OlaiWorld, said: string) {
    await undoSaid(this, said, "alarm");
  },
);

Then("nothing is said about the undo", async function (this: OlaiWorld) {
  await this.waitUntil(
    async () => (await this.page.locator(UNDO_SAID).count()) === 0,
    "the page to say nothing about an undo",
  );
});

// ── somebody else, writing ─────────────────────────────────────────────

/**
 * Another writer, mid-scenario: a git pull, the agent, a second tab.
 *
 * APPENDED rather than written whole, which is the whole reason these are here
 * and `I rewrite` is not: rewriting the file would also revert whatever the
 * keys under test just did, and what these scenarios are about is an undo
 * meeting a set that has moved UNDERNEATH it. The ids are fixed and named in
 * the feature, so the scenario can point at the row and say it is still there.
 */
const append = (world: OlaiWorld, file: string, record: string): void => {
  const lines = world
    .servedNodes(file)
    .map((node) => JSON.stringify(node))
    .concat(record);
  world.writeServed(file, lines.join("\n"));
};

When(
  "another writer adds {string} to {string}",
  function (this: OlaiWorld, title: string, file: string) {
    append(
      this,
      file,
      JSON.stringify({ id: "outsider", ord: "z0", title }),
    );
  },
);

When(
  "another writer files a row under {string} in {string}",
  function (this: OlaiWorld, under: string, file: string) {
    // By TITLE, because the row it goes under is one this scenario has just
    // typed and the id was minted by the write — which is exactly the id an
    // undo of that write names, and the point of the scenario.
    const parent = this.servedNodes(file).find((node) => node["title"] === under);
    assert.ok(
      parent !== undefined,
      `${file} holds no node titled ${JSON.stringify(under)} to file anything under`,
    );
    append(
      this,
      file,
      JSON.stringify({
        id: "interloper",
        parent: parent["id"],
        ord: "a0",
        title: "and something filed under it",
      }),
    );
  },
);
