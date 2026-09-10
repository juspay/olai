import { Given, When, Then } from "@cucumber/cucumber";
import { TITLE_EDITOR } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";
const pages = new WeakMap<OlaiWorld, { held: boolean; pending: Array<() => void> }>();
Given("outline page revisions can be held after their writes reply", async function(this: OlaiWorld) {
  const state = { held: false, pending: [] as Array<() => void> };
  pages.set(this, state);
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer();
    const requests = new Set<string>();
    client.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        if (frame._tag === "Request" && /\/page\/[^/]+$/.test(frame.tag)) requests.add(String(frame.id));
      }
      server.send(message);
    });
    server.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        const send = () => client.send(`${line}\n`);
        if (state.held && frame._tag === "Chunk" && requests.has(String(frame.requestId))) state.pending.push(send);
        else send();
      }
    });
  });
});
When("I hold the next outline page revision", function(this: OlaiWorld) {
  pages.get(this)!.held = true;
});
When("I release the held outline page revision", async function(this: OlaiWorld) {
  const state = pages.get(this)!;
  await this.waitUntil(async () => state.pending.length > 0, "the structural write's page frame to be held");
  state.held = false;
  for (const send of state.pending.splice(0)) send();
});
Then("no title editor remains after clicking away", async function(this: OlaiWorld) {
  await this.page.locator(TITLE_EDITOR).waitFor({ state: "detached" });
});
