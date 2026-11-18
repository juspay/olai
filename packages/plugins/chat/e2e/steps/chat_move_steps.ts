/**
 * THE ONE-TIME MOVE — what becomes of PR #700's link-titled chat rows the
 * first time a serve that knows about notes reads the vault.
 *
 * A row whose TITLE was an address naming a held `.md` was standing in for
 * that note; the note itself now carries the tie, so the move writes it there
 * and takes the property off the row. Everything else — a row for an outline,
 * a row for a picture, an ordinary chat row, a note that already had a
 * different tie — is left exactly as it was, with its agent, its children and
 * its title.
 *
 * These steps read the DISK, because that is where the claim is: the move is a
 * rewrite of the vault, and what a person (or a `git pull`) sees afterwards is
 * the file. The chat server's own unit tests hold the rule
 * (`../../src/server/move.ts`); what is held here is that it ran, once, under
 * the real binding permit, and that a restart adds nothing.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Then } from "@olai/tests/harness/runner.ts";
import { HYDRATION_TIMEOUT } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const INBOX = "_olai/Inbox.olai";

/** The top-level keys of a note's leading `---` block, read off the bytes. */
const matterOf = (world: OlaiWorld, note: string): Record<string, string> => {
  const text = fs.readFileSync(path.join(world.scratch(), note), "utf8");
  if (!text.startsWith("---\n")) return {};
  const end = text.indexOf("\n---", 3);
  if (end === -1) return {};
  const entries: Record<string, string> = {};
  for (const line of text.slice(4, end + 1).split("\n")) {
    const at = line.indexOf(":");
    if (at <= 0) continue;
    entries[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return entries;
};

const rowOf = (world: OlaiWorld, id: string): Record<string, unknown> => {
  const row = world.servedNodesSoFar(INBOX).find((node) => node.id === id);
  assert.ok(row !== undefined, `the Inbox holds no row called ${id}`);
  return row;
};

const agentOf = (row: Record<string, unknown>): unknown =>
  ((row.custom ?? {}) as Record<string, unknown>)["chat-agent-session"];

Then("the note {string} carries the tie {string} and opens alone", async function (this: OlaiWorld, note: string, tie: string) {
  await this.waitUntil(async () => matterOf(this, note)["chat-agent-session"] === tie,
    `${note} to carry the tie ${tie}`, HYDRATION_TIMEOUT);
  assert.equal(matterOf(this, note)["chat-opens"], "alone", `${note} does not say how its chat opens`);
});

Then("the note {string} carries the tie {string} and nothing else", function (this: OlaiWorld, note: string, tie: string) {
  const matter = matterOf(this, note);
  assert.equal(matter["chat-agent-session"], tie, `${note}'s tie was rewritten`);
  assert.equal(matter["chat-opens"], undefined, `${note} was given a chat-opens it never had`);
});

/** The row the move untied: still there, still titled, still holding what was
 *  under it — a move is not a deletion, and the rows under a chat row are the
 *  memory somebody wrote. */
Then("the chat row {string} is still titled {string} with {int} children and no agent", async function (this: OlaiWorld, id: string, title: string, children: number) {
  await this.waitUntil(async () => agentOf(rowOf(this, id)) === undefined,
    `the row ${id} to be untied`, HYDRATION_TIMEOUT);
  const row = rowOf(this, id);
  assert.equal(row.title, title, `the row ${id} was retitled`);
  assert.equal(this.servedNodesSoFar(INBOX).filter((node) => node.parent === id).length, children,
    `the row ${id} lost what was under it`);
});

Then("the chat row {string} keeps the agent {string}", function (this: OlaiWorld, id: string, tie: string) {
  assert.equal(agentOf(rowOf(this, id)), tie, `the row ${id} lost its agent`);
});
