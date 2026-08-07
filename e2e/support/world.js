// The scenario's world: one temp outline, one server, one browser context.
//
// Everything a step needs is reached through here, and nothing here knows what
// any scenario is about. The page is the only thing steps assert against —
// this suite is the one place in the repo that runs the JS.

import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { World } from "@cucumber/cucumber";

import { DOC, DOC_PATH, FIXTURE } from "./outline.js";
import { OLAI_BIN, startServer } from "./server.js";

const run = promisify(execFile);

// A desktop, because the layout most scenarios assert is the desktop one: the
// sidebar is a column, and the chat panel sits BESIDE the outline rather than
// over it (the phone rules are a @media away and would make the geometry
// assertions say nothing).
const VIEWPORT = { width: 1280, height: 900 };

// And the other layout, for the scenarios that are about it: an iPhone 14 in
// CSS pixels, well under phone-max (48rem), where the panel is a sheet OVER
// the outline. A scenario asks for it with @phone (hooks.js).
export const PHONE_VIEWPORT = { width: 390, height: 844 };

// The sentinel a mark leaves on the page. A reload wipes it; an htmx swap does
// not — which is the whole difference "without a reload" is about.
const MARK = "__olai_e2e_mark";

export class OlaiWorld extends World {
  /** Temp outline + server + a fresh browser context. `browser` is the run's
   *  (hooks.js owns it): a context per scenario is what makes localStorage —
   *  the fold state, the theme, the chat panel's open bit — start empty. The
   *  viewport is a desktop unless the scenario asked for the other one.
   *
   *  `extras` is more roots staged beside the outline, chosen by the
   *  scenario's tags (hooks.js) — each one a step that puts a file in the
   *  directory, whether it writes a constant or runs the product to get one.
   *  Staged at boot because they are the state the scenario starts IN — an
   *  outline home that already has a second file, an archive with something in
   *  it, a journal with today in it — not because a server cannot see one
   *  arrive: `serve DIR` re-asks the directory, and archive.feature's first
   *  scenario is exactly a root written later. */
  async boot(browser, env = {}, viewport = VIEWPORT, extras = []) {
    this.serverEnv = env;
    this.dir = await fs.mkdtemp(path.join(os.tmpdir(), "olai-e2e-"));
    this.outlinePath = path.join(this.dir, "Tasks.jsonl");
    // the document first: the outline's @doc names it, and the language
    // refuses an outline whose document is not there
    await this.rewriteDoc(DOC);
    await this.rewrite(FIXTURE);
    for (const stage of extras) {
      await stage(this);
    }

    // The context does not depend on the URL, and the racket boot is the
    // second the scenario actually waits for; it may as well cover both.
    const [server, context] = await Promise.all([
      startServer(this.dir, env),
      browser.newContext({ viewport }),
    ]);
    this.server = server;
    this.context = context;
    this.page = await context.newPage();
  }

  /** Take the server away, and put one back at the same address.
   *
   *  The honest way to test a stream that died: not an app pretending, but the
   *  socket actually gone — a restart, a deploy, a box that rebooted. What the
   *  page has to do about it is the whole feature, and a second process is
   *  also the case a naive revision counter gets wrong (it starts at one
   *  again, so a tab that reconnects looks caught up when it is not). */
  async stopServer() {
    this.serverPort = Number(new URL(this.server.url).port);
    await this.server.stop();
    this.server = null;
  }

  async startServerAgain() {
    this.server = await startServer(this.dir, this.serverEnv, this.serverPort);
  }

  async shutdown() {
    // The browser and the server have nothing to say to each other on the way
    // out; only the temp dir has to outlive the server that is reading it.
    await Promise.all([
      this.context?.close(),
      this.server?.stop(),
    ]);
    if (this.dir) await fs.rm(this.dir, { recursive: true, force: true });
  }

  url(pathname = "/") {
    return this.server.url + pathname;
  }

  async open(pathname = "/") {
    await this.page.goto(this.url(pathname));
  }

  /** Click a link that navigates the live view.
   *
   *  A link here does NOT load a document: it fetches the region, morphs it in
   *  and pushes the address (live/client). So there is no navigation for
   *  playwright to wait on, and a step that clicked and then read the page
   *  would be reading the page it clicked on.
   *
   *  What it waits for is the SWAP settling, not the address moving. Those are
   *  not the same moment — htmx pushes the URL and then renames the tab and
   *  runs the settle phase — and waiting on the earlier one would leave every
   *  step written after this to discover the difference on its own. */
  async follow(locator) {
    await this.settle(() => locator.click());
  }

  /** The same wait around anything else that navigates the live view — a key
   *  press, rather than a click on something. Two spellings of one moment:
   *  arm the listener, do the thing, wait for the swap to settle. */
  async settle(act) {
    await this.page.evaluate(() => {
      window.__olai_e2e_settled = false;
      document.addEventListener(
        "htmx:afterSettle",
        () => {
          window.__olai_e2e_settled = true;
        },
        { once: true },
      );
    });
    await act();
    await this.page.waitForFunction(() => window.__olai_e2e_settled === true);
  }

  // ---- the outline file ---------------------------------------------------

  /** Rewrite the outline under the running server. */
  async rewrite(text) {
    this.outline = text;
    await fs.writeFile(this.outlinePath, text, "utf8");
  }

  /** Add to the outline under the running server (see outline.js on sizes). */
  async append(text) {
    await this.rewrite(this.outline + text);
  }

  /** Write a file BESIDE the outline, parents and all.
   *
   *  Not an outline edit — the .rkt the server was started on does not move —
   *  and both scenarios that need one are about exactly that: an @include
   *  fragment simply appearing in a directory a glob reads, and a @doc
   *  document rewritten under a page that still has to redraw. */
  async write(rel, text) {
    const p = path.join(this.dir, rel);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, text, "utf8");
  }

  /** Rewrite the document a node's @doc attaches. */
  async rewriteDoc(text) {
    await this.write(DOC_PATH, text);
  }

  /** A write command against this scenario's outline, as an agent would run
   *  it — the same binary the server is, editing the file under it. `git` is
   *  not in a temp dir, so `--no-commit` is only saying so out loud.
   *
   *  Flags first, then `rest`: TITLE is the trailing words, so anything after
   *  it is another word of the title (docs/cli.md).
   *
   *  The file is read back afterwards: the CLI, not `rewrite`, is what wrote
   *  it, and a later step that edits the text has to start from what is
   *  actually there. */
  async olai(command, ...rest) {
    await this.olaiOn("Tasks.jsonl", command, ...rest);
  }

  /** The same command pointed at another outline in this scenario's
   *  directory. `--file` is where the command was TYPED; an `^anchor` names
   *  one node across the whole set, so the write may land in the file that
   *  DECLARES it — which is what this is for. The fixture is read back either
   *  way, because that is the file such a write goes to. */
  async olaiOn(name, command, ...rest) {
    await run(OLAI_BIN, [
      command,
      "--no-commit",
      "--file",
      path.join(this.dir, name),
      ...rest,
    ]);
    this.outline = await fs.readFile(this.outlinePath, "utf8");
  }

  /** Another root beside the outline, as text: the staging step a constant
   *  fixture becomes (hooks.js, EXTRA_ROOTS). */
  async stage(name, text) {
    await fs.writeFile(path.join(this.dir, name), text, "utf8");
  }

  /** The day journal, written by the product's own command: Daily.jsonl, this
   *  month's fragment, and a day node for today (docs/cli.md, `daily`).
   *
   *  A calendar scenario needs a day that IS today, which no committed fixture
   *  can hold — and the harness must not be the one deciding which day that
   *  is. `olai daily` reads the same clock the server will, in the same
   *  binary, so there is still only one. A staging step like the constants
   *  beside it, and for the same reason: it is the state these scenarios
   *  start in. */
  async daily() {
    const { stdout } = await run(OLAI_BIN, ["daily", "--no-commit", "--home", this.dir]);
    // WHICH day it wrote, from the command that wrote it. `today()` below
    // reads the day off /today's EMPTY state, and staging the journal is
    // exactly what empties that state of an answer — so the scenarios that
    // have a journal ask this instead. Still one clock: the CLI and the
    // server are the same binary on the same machine (docs/cli.md, `daily`).
    this.journalDay = JSON.parse(stdout).day;
  }

  /** The server's idea of today, asked of the server: an ISO day the outline
   *  can be given a node for. A harness that computed one itself would be a
   *  second clock, and the two disagree for an hour twice a year.
   *
   *  Read off `/today`'s empty state, which names the day it went looking for.
   *  It used to come from `/api/agenda`, and that route retired with the dated
   *  queries; this is the surface the server still answers the question on —
   *  so it only answers while there is NO day node yet, which is the only
   *  moment either caller asks (both are about creating one). */
  async today() {
    const res = await fetch(this.url("/today"));
    const html = await res.text();
    const m = /No day node for (\d{4}-\d{2}-\d{2})/.exec(html);
    if (!m) {
      throw new Error(
        "/today names no day: the outline already has today's node",
      );
    }
    return m[1];
  }

  /** The stream a PAGE would open, read out of a page's own markup.
   *
   *  The address is not a route this harness may know: it carries the boot id
   *  of the process that drew the page (`/live/<boot-id>/events`), which is
   *  how a tab that outlived a restart is told to reload instead of sitting
   *  subscribed to a server that is gone. A harness that spelled it would be
   *  spelling one server's identity at another one. */
  async streamUrl() {
    const res = await fetch(this.url("/"));
    const html = await res.text();
    const m = /sse-connect="([^"]+)"/.exec(html);
    if (!m) throw new Error("the page carries no stream");
    return new URL(m[1], this.url("/")).toString();
  }

  // ---- the agent's boot ---------------------------------------------------

  /** Wait until the agent's boot frames have landed ON THE SERVER.
   *
   *  `serve` prints its URL and starts answering while the agent is still
   *  waking up in its own thread, so the first second of a server's life is a
   *  conversation with no name, no model and no commands yet. A page opened in
   *  that window does not miss them — the stream catches a connection up on
   *  the way in, which is what features/sessions.feature's last scenario is
   *  about — but the PICKER is a question for the agent itself, and a scenario
   *  about what it can offer waits here first.
   *
   *  Asked of the stream, which is where the answer is: a connection is told
   *  the conversation as it stands, and the command list is the last thing a
   *  boot has to say about it. Frames are JSON; this parses them. */
  async waitForAgent(timeout = 20_000) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), timeout);
    try {
      const res = await fetch(await this.streamUrl(), { signal: control.signal });
      for await (const frame of sseFrames(res.body)) {
        if (frame.event === "chat" && JSON.parse(frame.data).type === "commands") return;
      }
      throw new Error("the event stream ended before the agent woke up");
    } catch (e) {
      if (control.signal.aborted) {
        throw new Error(`the agent was still waking up after ${timeout}ms`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
      control.abort();
    }
  }

  // ---- addressing a node --------------------------------------------------
  //
  // The two panes draw the SAME shell (.ol-node / .ol-row / .ol-children,
  // web/render's node-shell) and differ in what sits in the row: a title in
  // the outline, a link in the sidebar tree. So do these.

  /** A main-pane node by (part of) its own title. `:scope >` is what keeps an
   *  ancestor — whose subtree also contains that title — from matching. */
  node(title) {
    return this.paneNode("#ol-outline", ".ol-title", title);
  }

  /** A sidebar-tree node by (part of) its own link text. */
  treeNode(title) {
    return this.paneNode("#ol-sidebar", ".ol-tree-link", title);
  }

  /** The same node, but only while it wears a state class. This is what a
   *  step waits on when the state is ARRIVING over SSE: waiting for an
   *  element to appear is sound, where reading a class off the element that
   *  is there now is a coin toss mid-swap. */
  nodeInState(title, cls) {
    return this.paneNode("#ol-outline", ".ol-title", title, `.${cls}`);
  }

  paneNode(pane, row, text, nodeClass = "") {
    return this.page.locator(`${pane} .ol-node${nodeClass}`).filter({
      has: this.page.locator(`:scope > .ol-row ${row}`, { hasText: text }),
    });
  }

  // ---- this page load -----------------------------------------------------

  /** Leave a mark on this page load. It survives every SSE swap and nothing
   *  else, so a step can tell a live update from a reload. */
  async mark() {
    await this.page.evaluate((k) => {
      window[k] = true;
    }, MARK);
  }

  async marked() {
    return await this.page.evaluate((k) => window[k] === true, MARK);
  }

  /** Wait for the mark to go, which is the one thing only a reload does.
   *  Polled in the page rather than asserted once: a reload the SERVER asked
   *  for arrives when its frame does, and the step that triggered it only
   *  started the process that will send it. */
  async waitForReload(timeout = 15_000) {
    await this.page.waitForFunction((k) => !window[k], MARK, { timeout });
  }
}

// ---- reading a stream -------------------------------------------------------

/** The events on an SSE body, one at a time: `{event, data}`, blank-line
 *  framed, every `data:` line of a multi-line payload joined back up. The
 *  heartbeat comes through as an event like any other (it is one — a client
 *  has to be able to notice it stopping); the one caller filters by name. */
async function* sseFrames(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = null;
      const data = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) event = line.slice(7);
        else if (line.startsWith("data: ")) data.push(line.slice(6));
      }
      if (event !== null) yield { event, data: data.join("\n") };
    }
  }
}
