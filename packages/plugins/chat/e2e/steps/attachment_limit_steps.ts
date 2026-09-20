import { FRAME_CHUNK_BYTES } from "@kolu/surface/frame-chunking";
import { createHash } from "node:crypto";
import { Then, When } from "@olai/tests/harness/runner.ts";
import { MAX_ATTACHMENT_BYTES, MAX_VIDEO_ATTACHMENT_BYTES } from "@olai/surface";
import { PLUGIN_TESTID } from "@olai/tests/harness/testids.ts";
import { selector } from "@olai/web/testlib";
import { CHAT_PANEL } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const drop = async (world: OlaiWorld, size: number, ...names: string[]): Promise<void> => {
  await world.page.evaluate(({ size, names, at }) => {
    const target = document.querySelector(at);
    if (target === null) throw new Error("the chat transcript is absent");
    const transfer = new DataTransfer();
    const bytes = new Uint8Array(size).fill(97);
    for (const name of names) {
      transfer.items.add(new File([bytes], name, { type: name.endsWith(".mp4") ? "video/mp4" : "text/plain" }));
    }
    for (const kind of ["dragenter", "dragover", "drop"]) {
      target.dispatchEvent(new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }));
    }
  }, { size, names, at: world.chatSelector(selector(PLUGIN_TESTID.chatTranscript)) });
};

When("I drop a text file one byte over the attachment limit", async function (this: OlaiWorld) {
  await drop(this, MAX_ATTACHMENT_BYTES + 1, "oversized.txt");
});

When("I drop a text file exactly at the attachment limit", async function (this: OlaiWorld) {
  await drop(this, MAX_ATTACHMENT_BYTES, "at-limit.txt");
});

/** Both size boundaries use the same byte pattern; only name and size vary. */
const confirmsBytes = async (world: OlaiWorld, name: string, size: number): Promise<void> => {
  const hash = createHash("sha256");
  const block = Buffer.alloc(65536, "a");
  for (let remaining = size; remaining > 0; remaining -= block.length) {
    hash.update(block.subarray(0, Math.min(remaining, block.length)));
  }
  const expected = `sha256 of ${name}: ${hash.digest("hex")}`;
  await world.waitUntil(async () => (await world.chat(CHAT_PANEL).innerText()).includes(expected), "the agent to hash the complete file on disk");
};

Then("the agent confirms every byte of the boundary attachment", async function (this: OlaiWorld) {
  await confirmsBytes(this, "at-limit.txt", MAX_ATTACHMENT_BYTES);
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
  await confirmsBytes(this, "large.mp4", MAX_ATTACHMENT_BYTES + 1);
});

When("I drop a video with two upload slices", async function (this: OlaiWorld) {
  await drop(this, FRAME_CHUNK_BYTES * 2, "progress.mp4");
});

When("I drop a large video and an oversized text file together", async function (this: OlaiWorld) {
  await drop(this, MAX_ATTACHMENT_BYTES + 1, "large.mp4", "oversized.txt");
});

Then("the agent read the two-slice video", async function (this: OlaiWorld) {
  const expected = `read ${FRAME_CHUNK_BYTES * 2} bytes from progress.mp4`;
  await this.waitUntil(async () => (await this.chat(CHAT_PANEL).innerText()).includes(expected), "the agent to read both upload slices");
});
