/**
 * DIAGNOSTIC, for the chat-interrupt flake lane (the_agent.feature:1246) —
 * REMOVED before the lane's final head, with the `@interrupt-trace` tags.
 *
 * THE SIGHTING IT EXISTS FOR. On ci@petit (aarch64-darwin, full suite,
 * parallel workers), `When I interrupt the agent with "done order"` burned
 * its whole 15s budget waiting for `[data-testid="chat-interrupt"]` to be
 * visible — on that scenario's SECOND turn, a full thinking→idle round trip
 * after the agent had advertised steering, and seconds after
 * `the agent is working` had witnessed `data-status="thinking"` on the same
 * store the control reads. Linux reproduction failed honestly; the venue is
 * the variable, so the venue carries the recorder.
 *
 * Three clocks, one dump:
 *
 *   - THE SERVER'S: `chat/src/chat.ts` appends an ndjson mark to
 *     `$OLAI_TRACE_FILE` for every send it is handed, every agent frame it
 *     receives (`advertised` — the moment the interrupt capability is known —
 *     among them) and every `status` / `talking` move it publishes.
 *   - THE WIRE'S, witnessed from the HARNESS: `hooks.ts` records every
 *     websocket frame carrying a `chat` member, in both directions, on the
 *     harness's clock — the same clock the steps run on, so "the send went
 *     out at T" and "the waitFor gave up at T+15s" are one timeline. A
 *     renderer stall cannot silence this one: it rides the browser process,
 *     not the page.
 *   - THE PAGE'S: the init script below watches the DOM itself — the panel's
 *     `data-status`, the interrupt control coming and going, long tasks,
 *     rAF gaps, visibility — and keeps it in `sessionStorage` (the PAINTS
 *     arrangement: the record is the TAB's, so a replaced document goes on
 *     adding rather than starting over). A MutationObserver sees the moment
 *     of insertion, which is exactly the "did it mount" question.
 *
 * The dump is read where the wait lives — `I interrupt the agent with` and
 * `the composer offers an interruption` in
 * `../step_definitions/chat_steps.ts`: ALWAYS on a failed wait, and on a
 * slow green one (>1s — a green run that nearly red is the mechanism showing
 * itself before it crosses the budget). One line per mark, `olai-trace|`
 * prefixed, on stderr, where the run's log already lives.
 *
 * Everything here is step-side; the only product-aware coupling is the two
 * testids passed to the init script.
 */

import fs from "node:fs";

import type { Page } from "playwright";

import type { OlaiWorld } from "./world.ts";

/** The tag that arms a scenario's recorder. */
export const TRACE_TAG = "@interrupt-trace";

/** Where the page's marks live — a `sessionStorage` key, namespaced the way
 *  the PAINTS recorder's is, and for the same reason (the record is the
 *  TAB's). */
export const TRACE_KEY = "__olaiInterruptTrace";

/** One witnessed websocket frame, on the harness's clock: its head, and —
 *  when it carries one — the window around the `talking` member, which is
 *  where the steers bit the control is drawn from sits (past the head's
 *  cut in a full-state Chunk). */
export interface TraceFrame {
  readonly t: number;
  readonly dir: "in" | "out";
  readonly head: string;
  readonly talking?: string;
}

/** Cap on the page's marks and on the wire witness alike: a scenario worth
 *  dumping is decided by its tail, not by its first hundred refreshes of
 *  nothing happening. */
const CAP = 600;

/** The shape of one page-side mark, as the init script writes it. */
interface PageMark {
  readonly t: number;
  readonly m: string;
  readonly [extra: string]: unknown;
}

/**
 * The init script: watch the panel and the renderer, and write down what
 * they did.
 *
 * SELF-CONTAINED — Playwright ships this to the browser as source; it closes
 * over nothing and takes its settings as one argument (the same arrangement
 * `./paints.ts`'s recorder has, for the same reason).
 */
export const recordInterruptTrace = (
  asked: { key: string; panel: string; interrupt: string; gapMs: number },
): void => {
  const held = (): Array<string> => {
    const said = sessionStorage.getItem(asked.key);
    return said === null ? [] : (JSON.parse(said) as Array<string>);
  };
  if (sessionStorage.getItem(asked.key) === null) {
    sessionStorage.setItem(asked.key, "[]");
  }
  const keep = (mark: Record<string, unknown>): void => {
    const all = [...held(), JSON.stringify({ t: Date.now(), ...mark })];
    sessionStorage.setItem(asked.key, JSON.stringify(all.slice(-600)));
  };

  keep({ m: "doc", href: location.href, ready: document.readyState });

  const PANEL = `[data-testid="${asked.panel}"]`;
  const INTERRUPT = `[data-testid="${asked.interrupt}"]`;

  /** The interrupt control at the moment it was seen entering or leaving:
   *  geometry and the computed face, so "mounted" and "visible" can be told
   *  apart after the fact (Playwright's 15s was spent on the SECOND). */
  const interruptMark = (m: string, el: Element): void => {
    const box = el.getBoundingClientRect();
    const face = getComputedStyle(el);
    keep({
      m,
      box: { x: box.x, y: box.y, w: box.width, h: box.height },
      disp: face.display,
      vis: face.visibility,
    });
  };

  const see = (added: Node): void => {
    if (!(added instanceof Element)) return;
    if (added.matches(INTERRUPT)) interruptMark("interrupt+", added);
    for (const inside of added.querySelectorAll(INTERRUPT)) {
      interruptMark("interrupt+", inside);
    }
    // A panel that came in wearing its status is the boot half of the story:
    // the attribute observer below only sees CHANGES.
    const panel = added.matches(PANEL) ? added : added.querySelector(PANEL);
    if (panel !== null) keep({ m: "panel", status: panel.getAttribute("data-status") });
  };

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") {
        if ((record.target as Element).matches(PANEL)) {
          keep({
            m: "panel-status",
            v: (record.target as Element).getAttribute("data-status"),
          });
        }
        continue;
      }
      for (const added of record.addedNodes) see(added);
      for (const removed of record.removedNodes) {
        if (!(removed instanceof Element)) continue;
        if (removed.matches(INTERRUPT)) keep({ m: "interrupt-", box: null, disp: null, vis: null });
      }
    }
  });
  // The DOCUMENT, for `./paints.ts`'s reason: there is no root element yet
  // when this runs, and a watcher installed on nothing proves nothing.
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-status"],
  });

  /** WHAT THE RENDERER WAS DOING, in the two shapes a stall comes in: one
   *  long task, and frames that stopped being offered. A 15s invisible
   *  control with these empty is not a stall; with a gap over the wait it
   *  is, and no other reading is left. */
  try {
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        keep({ m: "longtask", start: Math.round(entry.startTime), dur: Math.round(entry.duration) });
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch {
    // A browser without longtask entries gets the rAF gaps below, which
    // answer the same question coarser.
  }
  let last = 0;
  const beat = (now: number): void => {
    if (last > 0 && now - last > asked.gapMs) {
      keep({ m: "raf-gap", ms: Math.round(now - last) });
    }
    last = now;
    requestAnimationFrame(beat);
  };
  requestAnimationFrame(beat);

  document.addEventListener("visibilitychange", () =>
    keep({ m: "vis", v: document.visibilityState }));
  window.addEventListener("pagehide", () => keep({ m: "pagehide" }));
  window.addEventListener("pageshow", () => keep({ m: "pageshow" }));
};

/** Keep only frames that mention the chat — its cell, its procedures, or a
 *  steer. The transcript's own collection rides other names and is not what
 *  this trace is for. */
export const carriesChat = (payload: string): boolean =>
  payload.includes("chat") || payload.includes("steer") || payload.includes("thinking");

/** Remember a frame, capped the same way the page's marks are. */
export const noteFrame = (frames: TraceFrame[], dir: "in" | "out", payload: string): void => {
  const at = payload.indexOf('"talking"');
  frames.push({
    t: Date.now(),
    dir,
    head: payload.slice(0, 200),
    ...(at === -1 ? {} : { talking: payload.slice(at, at + 220) }),
  });
  if (frames.length > CAP) frames.splice(0, frames.length - CAP);
};

/** The testids the probe and recorder are built against — here once, so the
 *  hook that installs the recorder and the dump that reads it agree. Written
 *  out rather than imported from the client's testids module: the support
 *  tree keeps to `world.ts`'s selectors, and these two strings are the whole
 *  of what this file shares with the client. */
export const TRACE_PANEL = "chat-panel";
export const TRACE_INTERRUPT = "chat-interrupt";

/** What the page looks like RIGHT NOW, asked of the page — the same snapshot
 *  the wait was failing over, plus the marks it kept. Read at dump time. */
const probe = async (page: Page): Promise<Record<string, unknown>> =>
  page.evaluate<Record<string, unknown>, { key: string; panel: string; interrupt: string }>(
    ({ key, panel, interrupt }) => {
      const say = (el: Element): Record<string, unknown> => {
        const box = el.getBoundingClientRect();
        const face = getComputedStyle(el);
        return {
          box: { x: box.x, y: box.y, w: box.width, h: box.height },
          disp: face.display,
          vis: face.visibility,
        };
      };
      const found = [...document.querySelectorAll(`[data-testid="${interrupt}"]`)];
      const panelEl = document.querySelector(`[data-testid="${panel}"]`);
      return {
        href: location.href,
        ready: document.readyState,
        visibility: document.visibilityState,
        panelStatus: panelEl === null ? null : panelEl.getAttribute("data-status"),
        panel: panelEl === null ? null : say(panelEl),
        interrupt: found.map(say),
        marks: (JSON.parse(sessionStorage.getItem(key) ?? "[]") as Array<string>).map(
          (line) => JSON.parse(line) as unknown,
        ),
      };
    },
    { key: TRACE_KEY, panel: TRACE_PANEL, interrupt: TRACE_INTERRUPT },
  );

/**
 * THE DISTRIBUTION, one line per wait, EVERY wait — the change after four
 * petit rounds of green-with-no-dump: waiting for a red is losing, so the
 * greens get measured instead.
 *
 * Deltas from the wait's own start, in ms, negative numbers for clocks that
 * moved earlier (the ordinary shape: the turn started a step or two ago):
 *
 *   - `send` — the last chat.send frame OUT before the wait (harness clock).
 *   - `srvTurn` / `wireTurn` / `panelTurn` — the turn-start, said by all
 *     three clocks: the server's `move`, the thinking chunk crossing the
 *     socket, the panel's attribute flip. Their spread IS the transport
 *     half of the question.
 *   - `adv` — when the interrupt capability became known (the server's
 *     `advertised`); `wireSteers` is the same fact arriving by socket.
 *   - `mount` — the control entering the DOM (page clock), geometry in the
 *     full dump. `waitMs` is when VISIBLE answered, so turnStart → mount →
 *     waitMs walks the whole draw path of one wait.
 *   - `stall` — long-task durations plus rAF gaps delivered inside the
 *     window. A 15s invisible control with this at ~0 is not a renderer
 *     stall; the trace says which clock holds seconds instead.
 *
 * One line that must come out even when gathering chokes — the summary is
 * the only evidence a never-red run leaves, so its own failure is a line
 * too, not silence.
 */
export const noteInterruptWait = async (
  world: OlaiWorld,
  kind: "press" | "offer",
  startedAt: number,
  endedAt: number,
): Promise<void> => {
  const out = (parts: string): void => {
    process.stderr.write(
      `olai-trace|wait|${kind}|waitMs=${endedAt - startedAt} ${parts}\n`,
    );
  };
  try {
    // THE PAGE'S CLOCK, with the same 4s mercy the dump gives it: a wedged
    // renderer is the finding here, not a reason to lose the line.
    const probed = await Promise.race([
      probe(world.page),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    const marks: ReadonlyArray<PageMark> = probed === null
      ? []
      : ((probed as { marks?: ReadonlyArray<PageMark> }).marks ?? []);
    const lastOf = (want: (mark: PageMark) => boolean): number | null => {
      for (let i = marks.length - 1; i >= 0; i--) {
        if (want(marks[i]!)) return marks[i]!.t;
      }
      return null;
    };
    const panelTurn = lastOf((m) => m.m === "panel-status" && m.v === "thinking")
      ?? lastOf((m) => m.m === "panel" && m.status === "thinking");
    const mount = lastOf((m) => m.m === "interrupt+");
    // Stalls delivered inside the window the wait could have felt: from a
    // breath before it opened to when it closed. A gap or task is stamped
    // with when it was NOTICED — for these marks that is the close of the
    // silence, which is the end of the span the wait survived.
    const stall = marks
      .filter((m) => {
        if (m.m === "longtask") return m.t >= startedAt - 300 && m.t <= endedAt;
        if (m.m === "raf-gap") return m.t >= startedAt - 300 && m.t <= endedAt;
        return false;
      })
      .reduce((sum, m) => sum + Number(m.dur ?? m.ms ?? 0), 0);

    // THE WIRE'S CLOCK — the harness's own, so these deltas share waitMs's
    // zero exactly.
    const frames = world.traceFrames ?? [];
    const lastWire = (want: (f: TraceFrame) => boolean, before: number): number | null => {
      for (let i = frames.length - 1; i >= 0; i--) {
        if (frames[i]!.t <= before && want(frames[i]!)) return frames[i]!.t;
      }
      return null;
    };
    const sent = lastWire(
      (f) => f.dir === "out" && f.head.includes("surface/chat/send"),
      startedAt,
    );
    const wireTurn = sent === null
      ? lastWire(
        (f) => f.dir === "in" && (f.head.includes("thinking") || (f.talking ?? "").includes("thinking")),
        startedAt,
      )
      : frames.find((f) =>
        f.dir === "in" && f.t >= sent &&
        (f.head.includes('"thinking"') || (f.talking ?? "").includes('"thinking"'))
      )?.t ?? null;
    const wireSteers = lastWire(
      (f) => f.dir === "in" && (f.talking ?? "").includes('"steers":true'),
      startedAt,
    );

    // THE SERVER'S CLOCK, off the file its tracer appends to (absent for a
    // corpus server — the field is just missing then).
    const server: ReadonlyArray<Record<string, unknown>> =
      world.traceFile === undefined ? [] : fs
        .readFileSync(world.traceFile, "utf8")
        .trim()
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    const lastServer = (want: (m: Record<string, unknown>) => boolean): number | null => {
      for (let i = server.length - 1; i >= 0; i--) {
        if (want(server[i]!)) return server[i]!.t as number;
      }
      return null;
    };
    const srvTurn = lastServer((m) => m.m === "move" && m.status === "thinking");
    const adv = lastServer((m) =>
      m.m === "recv" && m.tag === "advertised" &&
      (m as { steers?: unknown }).steers === true
    );

    const d = (name: string, t: number | null): string[] =>
      t === null ? [] : [`${name}=${t - startedAt}`];
    out(
      [
        ...d("send", sent),
        ...d("srvTurn", srvTurn),
        ...d("wireTurn", wireTurn),
        ...d("panelTurn", panelTurn),
        ...d("mount", mount),
        ...d("adv", adv),
        ...d("wireSteers", wireSteers),
        `stall=${Math.round(stall)}`,
        ...(probed === null ? ["probe=timeout"] : []),
      ].join(" "),
    );
  } catch (cause) {
    out(`summary-failed=${JSON.stringify(String(cause))}`);
  }
};

/**
 * Say everything the three clocks know, one line per mark, never throwing:
 * this runs on a scenario's failure path, where a recorder that throws is a
 * red scenario reporting the recorder instead of the control.
 */
export const dumpInterruptTrace = async (
  world: OlaiWorld,
  label: string,
  waitedMs: number,
): Promise<void> => {
  const out = (kind: string, body: unknown): void => {
    process.stderr.write(`olai-trace|${kind}|${JSON.stringify(body)}\n`);
  };
  try {
    out("dump", { label, waitedMs, at: Date.now() });
    // THE PAGE, asked — with a budget of its own, because the interesting
    // failure IS a page that cannot answer: an evaluate that outruns its
    // 4s is the renderer-stall half of the world saying so itself.
    try {
      const snapshot = await Promise.race([
        probe(world.page),
        new Promise<"silent">((resolve) => setTimeout(() => resolve("silent"), 4000)),
      ]);
      if (snapshot === "silent") {
        out("probe", { answered: false, note: "page.evaluate did not return within 4s" });
      } else {
        const { marks, ...rest } = snapshot as {
          marks: ReadonlyArray<PageMark>;
        } & Record<string, unknown>;
        out("probe", { answered: true, ...rest });
        for (const mark of marks ?? []) out("page", mark);
      }
    } catch (cause) {
      out("probe", { answered: false, note: String(cause) });
    }
    // THE WIRE, witnessed from the harness — the frames that mention chat,
    // newest last, on the same clock as `waitedMs`.
    for (const frame of world.traceFrames ?? []) out("wire", frame);
    // THE SERVER'S OWN WORDS, if this scenario's server was given a file.
    if (world.traceFile !== undefined) {
      try {
        const lines = fs.readFileSync(world.traceFile, "utf8").trim().split("\n");
        for (const line of lines.slice(-400)) {
          if (line !== "") out("server", JSON.parse(line));
        }
      } catch (cause) {
        out("server", { note: `trace file unreadable: ${String(cause)}` });
      }
    }
    out("dumped", { label });
  } catch (cause) {
    process.stderr.write(`olai-trace|dump-failed|${String(cause)}\n`);
  }
};
