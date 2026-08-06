// The scenario's world: one temp outline, one server, one browser context.
//
// Everything a step needs is reached through here, and nothing here knows what
// any scenario is about. The page is the only thing steps assert against —
// this suite is the one place in the repo that runs the JS.

import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { World } from "@cucumber/cucumber";

import { FIXTURE } from "./outline.js";
import { startServer } from "./server.js";

// A desktop, because the layout the scenarios assert is the desktop one: the
// sidebar is a column, and the chat panel sits BESIDE the outline rather than
// over it (the phone rules are a @media away and would make the geometry
// assertions say nothing).
const VIEWPORT = { width: 1280, height: 900 };

// The sentinel a mark leaves on the page. A reload wipes it; an htmx swap does
// not — which is the whole difference "without a reload" is about.
const MARK = "__olai_e2e_mark";

export class OlaiWorld extends World {
  /** Temp outline + server + a fresh browser context. `browser` is the run's
   *  (hooks.js owns it): a context per scenario is what makes localStorage —
   *  the fold state, the theme, the chat panel's open bit — start empty. */
  async boot(browser, env = {}) {
    this.dir = await fs.mkdtemp(path.join(os.tmpdir(), "olai-e2e-"));
    this.outlinePath = path.join(this.dir, "Tasks.rkt");
    await this.rewrite(FIXTURE);

    // The context does not depend on the URL, and the racket boot is the
    // second the scenario actually waits for; it may as well cover both.
    const [server, context] = await Promise.all([
      startServer(this.dir, env),
      browser.newContext({ viewport: VIEWPORT }),
    ]);
    this.server = server;
    this.context = context;
    this.page = await context.newPage();
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

  /** The server's idea of today, asked of the server: an ISO day the outline
   *  can be given a node for. A harness that computed one itself would be a
   *  second clock, and the two disagree for an hour twice a year. */
  async today() {
    const res = await fetch(this.url("/api/agenda"));
    return (await res.json()).today;
  }

  // ---- the agent's boot ---------------------------------------------------

  /** Wait until the agent's boot frames have landed ON THE SERVER.
   *
   *  `serve` prints its URL and starts answering while the agent is still
   *  waking up in its own thread, so the first second of a server's life is a
   *  panel that does not know its model, its conversation or its commands yet.
   *  A page opened in that window never learns: the frames are broadcast to
   *  whoever is listening, and it was not born yet (see the @skip scenario in
   *  features/sessions.feature).
   *
   *  The command list is the LAST boot frame — the same signal Roadmap.rkt
   *  names for the racket suite's version of this race — so the page carrying
   *  a non-empty one is the agent being all the way up. */
  async waitForAgent(timeout = 20_000) {
    const deadline = Date.now() + timeout;
    for (;;) {
      const html = await (await fetch(this.url("/"))).text();
      if (/data-commands="\[\{/.test(html)) return;
      if (Date.now() > deadline) {
        throw new Error(`the agent was still waking up after ${timeout}ms`);
      }
      await new Promise((r) => setTimeout(r, 50));
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

  paneNode(pane, row, text) {
    return this.page.locator(`${pane} .ol-node`).filter({
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
}
