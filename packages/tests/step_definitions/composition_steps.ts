import * as assert from "node:assert";
import { When } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";

When("I confirm the IME text {string} in the focused field", async function (this: OlaiWorld, text: string) {
  const session = await this.context.newCDPSession(this.page);
  try {
    await session.send("Input.imeSetComposition", {
      text, selectionStart: text.length, selectionEnd: text.length,
    });
    // Chromium supplies the composition state; do not fabricate isComposing.
    await this.page.evaluate(() => {
      const field = document.activeElement;
      if (!(field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement)) {
        throw new Error("IME requires a focused text field");
      }
      window.addEventListener("keydown", (event) => {
        document.documentElement.dataset.imeConfirmation = String(event.isComposing);
      }, { once: true, capture: true });
    });
    // An IME confirmation has a keydown and commits its candidate; it does
    // not also emit Playwright's ordinary Enter text character (a newline).
    await session.send("Input.dispatchKeyEvent", {
      type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13,
    });
    const composing = await this.page.evaluate(() => document.documentElement.dataset.imeConfirmation);
    assert.equal(composing, "true", "the confirming Enter must come from active browser composition");
    await session.send("Input.insertText", { text });
    await session.send("Input.dispatchKeyEvent", {
      type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13,
    });
  } finally {
    await session.detach();
  }
});
