import { TESTID } from "../../src/testids.ts"
import * as assert from "node:assert"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { attr } from "@olai/tests/harness/selectors.ts"
import { Then } from "@olai/tests/harness/runner.ts"
import type { OlaiWorld } from "@olai/tests/harness/world.ts"

Then("the mail {word} story says {string}", async function(this: OlaiWorld, kind: string, text: string) {
  await this.waitUntil(async () => {
    const stories = this.page.locator(`${attr("data-testid", TESTID.mailStory)}${attr("data-mail-story", kind)}`)
    return (await stories.allTextContents()).some(t => t.includes(text))
  }, `mail ${kind} story to say ${text}`)
})
Then("the fake mailbox has received no {word} calls", async function(this: OlaiWorld, verb: string) {
  const file = join(dirname(this.mailHimalaya!.path), "calls.ndjson")
  const calls = existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map(line => JSON.parse(line)) : []
  assert.equal(calls.filter(c => verb === "tool" ? c.verb !== "profile.get" : verb === "send" ? c.verb.endsWith(".send") : c.verb === (verb.includes(".") ? verb : `threads.${verb}`)).length, 0)
})
const saved = new WeakMap<OlaiWorld, string>()
Then("the mail attachment is outside the vault under the runtime directory", async function(this: OlaiWorld) {
  const log = join(dirname(this.mailHimalaya!.path), "calls.ndjson")
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
  await this.waitUntil(async () => (await this.page.locator(`${attr("data-testid", TESTID.mailStory)}${attr("data-mail-story", "refused")}`).count()) === count, `${count} mail refusal stories`)
})

Then("the saved mail draft {string} has header {string} equal to {string}", async function(this: OlaiWorld, id: string, header: string, value: string) {
  const file = join(dirname(this.mailHimalaya!.path), `draft-${id}.json`)
  assert.equal(JSON.parse(readFileSync(file, "utf8")).headers[header], value)
})
Then("the saved mail draft {string} has body {string}", async function(this: OlaiWorld, id: string, body: string) {
  const file = join(dirname(this.mailHimalaya!.path), `draft-${id}.json`)
  const draft = JSON.parse(readFileSync(file, "utf8"))
  assert.equal(draft.body, body)
  assert.equal(draft.args.at(-2), "--")
  await this.waitUntil(async () => !existsSync(draft.file), "draft message file cleanup")
  assert.ok(draft.file.includes("/runtime/olai-mail-"), draft.file)
  const calls = readFileSync(join(dirname(this.mailHimalaya!.path), "calls.ndjson"), "utf8").trim().split("\n").map(line => JSON.parse(line))
  assert.ok(calls.every(c => !c.verb.endsWith(".send")))
})
Then("the saved mail draft {string} belongs to thread {string}", async function(this: OlaiWorld, id: string, thread: string) {
  const draft = JSON.parse(readFileSync(join(dirname(this.mailHimalaya!.path), `draft-${id}.json`), "utf8"))
  assert.equal(draft.args[draft.args.indexOf("--thread-id") + 1], thread)
  assert.equal(draft.headers.Cc, undefined)
  assert.equal(draft.headers.Bcc, undefined)
})
