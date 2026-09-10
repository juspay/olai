/** Transport fault injection complements configuration.test.ts's real withdrawal race.
 * The write reaches the server; its settlement answer is replaced at the wire
 * so the browser's refusal path is deterministic even on a fast local disk. */
import { Given } from "@cucumber/cucumber";
import type { OlaiWorld } from "../support/world.ts";

Given("the next switch settlement reports a withdrawn reader", async function(this: OlaiWorld) {
  let replaced = false;
  await this.page.routeWebSocket(url => url.pathname === "/rpc/ws", client => {
    const server = client.connectToServer();
    const switches = new Set<string>();
    client.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        if (frame._tag === "Request" && frame.tag === "surface/plugins/set") switches.add(String(frame.id));
      }
      server.send(message);
    });
    server.onMessage(message => {
      for (const line of String(message).split("\n").filter(Boolean)) {
        const frame = JSON.parse(line);
        if (!replaced && frame._tag === "Exit" && switches.has(String(frame.requestId))) {
          replaced = true;
          frame.exit = { _tag: "Failure", cause: [{ _tag: "Fail", error: { _tag: "UsageFailure", reason: "The configuration reader withdrew before the change settled. The file retains the write." } }] };
          client.send(JSON.stringify(frame) + "\n");
        } else client.send(line + "\n");
      }
    });
  });
});
