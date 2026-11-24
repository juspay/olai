/**
 * THE CONNECTION'S OWN ACCOUNT, read where a person reads it: the server's log.
 *
 * Each tab keeps a diary of its socket and posts it to the server, which logs
 * every entry with `side=browser` beside its own lines about the same socket
 * (`@olai/web`'s `connection/diary.ts`, `@olai/server`'s `diary.ts`). These
 * steps stage the ways a connection drops — from the browser, through a man in
 * the middle on the socket, or by stopping the server — and then read the
 * server's stdout, because that is the claim: the log says why.
 *
 * THE MIDDLE is `routeWebSocket` on the tab's one socket path, registered
 * before the page dials (a route added afterwards does not see the socket under
 * test). It forwards both ways, and on a step's word closes a socket with a
 * code, speaks a line of its own to the page, or drops every socket a second
 * after it opens.
 */

import * as assert from "node:assert";

import { Given, Then, When } from "@cucumber/cucumber";
import { RPC_MAX_FRAME_BYTES } from "@kolu/surface/frame-limit";
import { readLogfmt } from "@olai/log/testlib";

import { HYDRATION_TIMEOUT } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

// ── the middle ─────────────────────────────────────────────────────────

interface Socket {
  close(options?: { code?: number; reason?: string }): Promise<void>;
  send(message: string | Buffer): void;
}
interface Link {
  readonly client: Socket;
  readonly server: Socket;
}
interface Middle {
  readonly links: Array<Link>;
  /** Sockets still to be dropped a second after they open. */
  dropsLeft: number;
}
const middles = new WeakMap<OlaiWorld, Middle>();

/** Close both ends of one routed socket with the same code. */
const sever = async (link: Link, code: number): Promise<void> => {
  await link.client.close({ code, reason: "the middle" });
  await link.server.close({ code, reason: "the middle" });
};

const DROP_AFTER_MS = 1_000;

/** A link the middle is due to drop: a second from now, while drops are left. */
const dropLater = (middle: Middle, link: Link): void => {
  if (middle.dropsLeft <= 0) return;
  middle.dropsLeft -= 1;
  setTimeout(() => void sever(link, 4000).catch(() => {}), DROP_AFTER_MS);
};

const middleOf = (world: OlaiWorld): Middle => {
  const middle = middles.get(world);
  assert.ok(middle, "put the socket through a middle first: `the page's socket runs through a middle`");
  return middle;
};

Given("the page's socket runs through a middle", async function (this: OlaiWorld) {
  const middle: Middle = { links: [], dropsLeft: 0 };
  middles.set(this, middle);
  // The pathname, not a glob: a redial carries `?pid=`, `tab=` and `dial=`,
  // and every one of those sockets has to come through here.
  await this.page.routeWebSocket((url) => url.pathname === "/rpc/ws", (client) => {
    const server = client.connectToServer();
    client.onMessage((message) => server.send(message));
    server.onMessage((message) => client.send(message));
    const link = { client, server };
    middle.links.push(link);
    dropLater(middle, link);
  });
});

/** The live link — the one the page is talking over right now. */
const live = (world: OlaiWorld): Link => {
  const link = middleOf(world).links.at(-1);
  assert.ok(link, "the page has made no socket through the middle");
  return link;
};

When("the middle closes the socket with code {int}", async function (this: OlaiWorld, code: number) {
  await sever(live(this), code);
});

When("the middle sends the page a line that is not JSON", function (this: OlaiWorld) {
  live(this).client.send("this line is not json\n");
});

When("the middle sends the page a line one character over the cap", function (this: OlaiWorld) {
  // The cap the tab's decoder holds, plus one, with no newline: the
  // unfinished line is already over it.
  live(this).client.send("x".repeat(RPC_MAX_FRAME_BYTES + 1));
});

When(
  "the middle drops each socket a second after it opens, {int} times",
  function (this: OlaiWorld, times: number) {
    const middle = middleOf(this);
    middle.dropsLeft = times;
    // The socket already open is the first; every redial after it is next.
    dropLater(middle, live(this));
  },
);

/** The person closes the tab: the page goes, with its `pagehide`, and its
 *  socket closes the way a closing tab closes it. */
When("I close this browser tab", async function (this: OlaiWorld) {
  await this.page.close();
});

// ── the server's log ───────────────────────────────────────────────────

type Line = Readonly<Record<string, string>>;

/** Every complete line of the server's stdout whose message is `message`. */
const linesOf = (world: OlaiWorld, message: string): ReadonlyArray<Line> => {
  const text = world.serverLog.text;
  const complete = text.endsWith("\n") ? text.split("\n") : text.split("\n").slice(0, -1);
  return complete.filter((line) => line !== "").map(readLogfmt).filter((fields) => fields.message === message);
};

/** `k=v k2=v2` as a record; a value may not hold a space. */
const wanted = (fields: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    fields.split(/\s+/).filter((pair) => pair !== "").map((pair) => {
      const at = pair.indexOf("=");
      assert.ok(at > 0, `\`${pair}\` is not key=value`);
      return [pair.slice(0, at), pair.slice(at + 1)];
    }),
  );

const matching = (world: OlaiWorld, message: string, fields: string): ReadonlyArray<Line> => {
  const want = wanted(fields);
  return linesOf(world, message).filter((line) => Object.entries(want).every(([key, value]) => line[key] === value));
};

const waitForLine = async (world: OlaiWorld, message: string, fields: string, timeout: number): Promise<void> => {
  await world.waitUntil(
    async () => matching(world, message, fields).length > 0,
    `the server to log "${message}" with ${fields}`,
    timeout,
  );
};

Then(
  "the server logs {string} with {string}",
  async function (this: OlaiWorld, message: string, fields: string) {
    await waitForLine(this, message, fields, HYDRATION_TIMEOUT);
  },
);

/** The same, for what takes a long time to happen: a heartbeat's verdict, a
 *  loop of a dozen redials. The step's own timeout is the longest it is ever
 *  asked for, plus room to fail with a sentence rather than a timeout. */
Then(
  "the server logs {string} with {string} within {int} seconds",
  { timeout: 200_000 },
  async function (this: OlaiWorld, message: string, fields: string, seconds: number) {
    await waitForLine(this, message, fields, seconds * 1_000);
  },
);

Then(
  "the server logs the browser's {string} at {string} with a cause among {string}",
  async function (this: OlaiWorld, message: string, level: string, causes: string) {
    const among = causes.split(",").map((one) => one.trim());
    await this.waitUntil(
      async () =>
        matching(this, message, `side=browser level=${level}`).some((line) => among.includes(line.cause ?? "")),
      `the server to log the browser's "${message}" at ${level} with a cause among ${among.join(", ")}`,
      HYDRATION_TIMEOUT,
    );
  },
);

/** The two accounts of one socket meet: the browser's line, and a server line
 *  with the same `tab` and `dial`. */
Then(
  "the browser's {string} and a server {string} name the same socket",
  function (this: OlaiWorld, browser: string, server: string) {
    const said = matching(this, browser, "side=browser").at(-1);
    assert.ok(said, `the browser said no "${browser}"`);
    assert.ok(said.tab !== undefined && said.dial !== undefined, `the browser's "${browser}" names no tab and dial`);
    const heard = linesOf(this, server).filter((line) => line.side === undefined);
    assert.ok(
      heard.some((line) => line.tab === said.tab && line.dial === said.dial),
      `no server "${server}" names tab=${said.tab} dial=${said.dial}; it said ` +
        JSON.stringify(heard.map((line) => ({ tab: line.tab, dial: line.dial }))),
    );
  },
);

Then(
  "the browser's {string} and the server's {string} name the same tab",
  function (this: OlaiWorld, browser: string, server: string) {
    const said = matching(this, browser, "side=browser").at(-1);
    assert.ok(said?.tab, `the browser said no "${browser}" with a tab`);
    assert.ok(
      linesOf(this, server).some((line) => line.tab === said.tab),
      `no server "${server}" names tab=${said.tab}`,
    );
  },
);

/** What the tab said, in the order it said it: each line after the one
 *  before, by the diary's own `seq`. */
Then(
  "the browser said {string}, then {string}, then {string}",
  function (this: OlaiWorld, first: string, second: string, third: string) {
    let after = -1;
    for (const message of [first, second, third]) {
      const next = matching(this, message, "side=browser")
        .map((line) => Number(line.seq))
        .filter((seq) => seq > after)
        .sort((a, b) => a - b)[0];
      assert.ok(next !== undefined, `the browser said no "${message}" after seq ${after}`);
      after = next;
    }
  },
);

Then(
  "the browser's {string} heard {string}",
  function (this: OlaiWorld, message: string, text: string) {
    const said = matching(this, message, "side=browser").at(-1);
    assert.ok(said, `the browser said no "${message}"`);
    assert.ok(
      (said.heard ?? "").includes(text),
      `the browser's "${message}" heard ${JSON.stringify(said.heard ?? "")}, not ${JSON.stringify(text)}`,
    );
  },
);

/** A loop, read at the level a person runs the server at: which of its drops
 *  were said at full level, by their streak. */
Then(
  "the browser's {string} lines at full level carry the streaks {string}",
  function (this: OlaiWorld, message: string, streaks: string) {
    const loud = matching(this, message, "side=browser cause=peer-closed")
      .filter((line) => line.level !== "DEBUG")
      .map((line) => line.streak);
    assert.deepStrictEqual(loud, streaks.split(",").map((one) => one.trim()));
  },
);

/**
 * NOTHING SAID, over a window — the one claim here that is an absence. A
 * closed tab's last words arrive in a beacon the server logs whenever it
 * lands, and nothing the page can show says when that is, so the step watches
 * the log for a fixed few seconds rather than waiting on an event.
 */
Then(
  "for {int} seconds the server logs nothing from the browser and no {string} or {string}",
  async function (this: OlaiWorld, seconds: number, first: string, second: string) {
    const loud = () => [
      ...linesOf(this, first),
      ...linesOf(this, second),
      ...this.serverLog.text.split("\n").filter((line) => line !== "").map(readLogfmt).filter((line) => line.side === "browser"),
    ];
    const deadline = Date.now() + seconds * 1_000;
    while (Date.now() < deadline) {
      assert.deepStrictEqual(loud(), [], "the server logged the ordinary life of a tab at the default level");
      await new Promise((done) => setTimeout(done, 250));
    }
    assert.deepStrictEqual(loud(), [], "the server logged the ordinary life of a tab at the default level");
  },
);
