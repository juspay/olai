import { FRAME_CHUNK_BYTES } from "@kolu/surface/frame-chunking";
import { createHash } from "node:crypto";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { MAX_ATTACHMENT_BYTES, MAX_VIDEO_ATTACHMENT_BYTES } from "@olai/surface";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { CHAT_PANEL } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const drop = async (world: OlaiWorld, size: number, name: string): Promise<void> => {
  await world.page.evaluate(({ size, name, at }) => {
    const target = document.querySelector(at);
    if (target === null) throw new Error("the chat transcript is absent");
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(size).fill(97)], name, { type: name.endsWith(".mp4") ? "video/mp4" : "text/plain" }));
    for (const kind of ["dragenter", "dragover", "drop"]) {
      target.dispatchEvent(new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }
  }, { size, name, at: world.chatSelector(selector(PLUGIN_TESTID.chatTranscript)) });
};

When("I drop a text file one byte over the attachment limit", async function (this: OlaiWorld) {
  await drop(this, MAX_ATTACHMENT_BYTES + 1, "oversized.txt");
});

When("I drop a text file exactly at the attachment limit", async function (this: OlaiWorld) {
  await drop(this, MAX_ATTACHMENT_BYTES, "at-limit.txt");
});

Then("the agent confirms every byte of the boundary attachment", async function (this: OlaiWorld) {
  const hash = createHash("sha256");
  const block = Buffer.alloc(65536, "a");
  for (let remaining = MAX_ATTACHMENT_BYTES; remaining > 0; remaining -= block.length) {
    hash.update(block.subarray(0, Math.min(remaining, block.length)));
  }
  const expected = `sha256 of at-limit.txt: ${hash.digest("hex")}`;
  await this.waitUntil(async () => (await this.chat(CHAT_PANEL).innerText()).includes(expected), "the harness to report the complete uploaded file's expected SHA-256");
});

When("I drop two different text files with the same name at once", async function (this: OlaiWorld) {
  await this.page.evaluate((at) => {
    const target = document.querySelector(at);
    if (target === null) throw new Error("the chat transcript is absent");
    for (const text of ["alpha", "bravo"]) {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], "collision.txt", { type: "text/plain" }));
      for (const kind of ["dragenter", "dragover", "drop"]) {
        target.dispatchEvent(new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }));
      }
    }
  }, this.chatSelector(selector(PLUGIN_TESTID.chatTranscript)));
});

Then("the agent confirms attachment content {string}", async function (this: OlaiWorld, content: string) {
  const digest = createHash("sha256").update(content).digest("hex");
  await this.waitUntil(async () => (await this.chat(CHAT_PANEL).innerText()).includes(digest), "the harness to read the expected attachment bytes");
});

When("I drop a video larger than the document limit", async function (this: OlaiWorld) {
  await drop(this, MAX_ATTACHMENT_BYTES + 1, "large.mp4");
});

When("I drop a video one byte over the video limit", async function (this: OlaiWorld) {
  await drop(this, MAX_VIDEO_ATTACHMENT_BYTES + 1, "oversized.mp4");
});

Then("the agent confirms every byte of the large video", async function (this: OlaiWorld) {
  const hash = createHash("sha256");
  const block = Buffer.alloc(65536, "a");
  for (let remaining = MAX_ATTACHMENT_BYTES + 1; remaining > 0; remaining -= block.length) {
    hash.update(block.subarray(0, Math.min(remaining, block.length)));
  }
  const expected = `sha256 of large.mp4: ${hash.digest("hex")}`;
  await this.waitUntil(async () => (await this.chat(CHAT_PANEL).innerText()).includes(expected), "the agent to hash the complete video on disk");
});

When("I drop a video with two upload slices", async function (this: OlaiWorld) {
  await drop(this, FRAME_CHUNK_BYTES * 2, "progress.mp4");
});

When("I drop a large video and an oversized text file together", async function (this: OlaiWorld) {
  await this.page.evaluate(({ size, at }) => {
    const target = document.querySelector(at);
    if (target === null) throw new Error("the chat transcript is absent");
    const transfer = new DataTransfer();
    const bytes = new Uint8Array(size).fill(97);
    transfer.items.add(new File([bytes], "large.mp4", { type: "video/mp4" }));
    transfer.items.add(new File([bytes], "oversized.txt", { type: "text/plain" }));
    for (const kind of ["dragenter", "dragover", "drop"]) {
      target.dispatchEvent(new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }
  }, { size: MAX_ATTACHMENT_BYTES + 1, at: this.chatSelector(selector(PLUGIN_TESTID.chatTranscript)) });
});
