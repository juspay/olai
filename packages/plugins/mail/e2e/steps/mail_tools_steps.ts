import { TESTID } from "../../src/testids.ts"
import * as assert from "node:assert"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { Then } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

Then("the mail {word} story says {string}", async function(this: OlaiWorld, kind: string, text: string) {
  await this.waitUntil(async () => {
    const stories = this.page.locator(`[data-testid="${TESTID.mailStory}"][data-mail-story="${kind}"]`)
    return (await stories.allTextContents()).some(t => t.includes(text))
  }, `mail ${kind} story to say ${text}`)
})
Then("the fake mailbox has received no {word} calls", async function(this: OlaiWorld, verb: string) {
  const file = join(dirname(this.mailHimalaya!.path), "calls.jsonl")
  const calls = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : []
  assert.equal(calls.filter(c => verb === "tool" ? c.verb !== "profile.get" : c.verb === `threads.${verb}`).length, 0)
})
const saved = new WeakMap<OlaiWorld, string>()
Then("the mail attachment is outside the vault under the runtime directory", async function(this: OlaiWorld) {
  const log = join(dirname(this.mailHimalaya!.path), "calls.jsonl")
  await this.waitUntil(async () => existsSync(log) && readFileSync(log, "utf8").includes("attachments.get"), "attachment download")
  const calls = readFileSync(log, "utf8").trim().split("\n").map(line => JSON.parse(line))
  const args: string[] = calls.findLast(c => c.verb === "attachments.get").args
  const path = args[args.indexOf("-o") + 1]!
  assert.ok(path.includes("/runtime/olai-mail-attachments-"), path)
  assert.ok(!path.startsWith(this.scratch() + "/"), path)
  assert.equal(readFileSync(path).length, 12288)
  saved.set(this, path)
})
Then("the saved mail attachment is gone", async function(this: OlaiWorld) {
  const path = saved.get(this)
  assert.ok(path)
  await this.waitUntil(async () => !existsSync(path), "mail attachment cleanup")
})

Then("the conversation has {int} mail refusal stories", async function(this: OlaiWorld, count: number) {
  await this.waitUntil(async () => (await this.page.locator(`[data-testid="${TESTID.mailStory}"][data-mail-story="refused"]`).count()) === count, `${count} mail refusal stories`)
})
