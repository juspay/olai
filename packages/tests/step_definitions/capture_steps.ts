/**
 * `olai surface capture`, run as a real process against the real server this
 * scenario is reading.
 *
 * The verb's own promises — which file a capture lands in, what it refuses,
 * what the record holds — are asserted where they live (`@olai/format`'s
 * `inbox.test.ts` for the composition, `@olai/server`'s `mcp/tools.test.ts` for
 * the tool end to end). Nothing here re-asserts them.
 *
 * What only THIS chain can say is the reason these steps exist: a line typed in
 * a terminal, while a person is reading something else, reaches the page they
 * have open — the Inbox door lights up and counts it, and today's journal lists
 * it. And the terminal is told where it went, in the one line a person can act
 * on, with the whole record a flag away.
 *
 * IT IS THE REAL BINARY, spawned, against the real HTTP door. A fetch could not
 * stand in for it: what is being asserted includes the CLI's own output
 * discipline and its exit codes, which are properties of a PROCESS. And the
 * address it is pointed at is this scenario's own `baseUrl` — the same one the
 * browser in the same scenario has open — so the two ends are demonstrably the
 * same server rather than two that happen to agree.
 *
 * `@scratch:` on every scenario that uses these: a capture WRITES the served
 * directory, and it mints `_olai/Inbox.org` in it.
 */

import * as assert from "node:assert";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Then, When } from "@cucumber/cucumber";

import { DAY_PAGE, HYDRATION_TIMEOUT, nodeSelector } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const run = promisify(execFile);

/** The id the last capture minted, per scenario, and the line it printed.
 *  A WeakMap rather than fields on the world: what a capture answered is this
 *  file's business, and the world is shared by fifty step modules that have no
 *  use for it. */
const lastCapture = new WeakMap<OlaiWorld, { readonly id?: string; readonly said: string }>();

/** The binary under test. `OLAI_BIN` is what the harness spawned the server
 *  with, so the CLI and the server are ONE build — which is the point: they
 *  share a surface definition and a verb table, and a drift between them would
 *  be invisible if the test used two. */
const binary = (): string => {
  const bin = process.env.OLAI_BIN;
  assert.ok(
    bin !== undefined && bin !== "",
    "these steps run the real `olai` binary; set OLAI_BIN (the harness does)",
  );
  return bin;
};

/**
 * One CLI run against THIS scenario's server, as a person would get it.
 *
 * `--url` is always passed and always this scenario's own address, because
 * there is nothing else: the flag is required and nothing underneath it can
 * supply a server. That is the design, and pointing it at `baseUrl` is what
 * makes this a test of the same server the browser above is reading.
 */
const cli = async (
  world: OlaiWorld,
  ...argv: ReadonlyArray<string>
): Promise<string> => {
  try {
    const { stdout } = await run(binary(), ["surface", ...argv, "--url", world.baseUrl], {
      env: { ...process.env },
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch (failure) {
    // The CLI writes prose to stderr and data to stdout, and a refusal is JSON
    // on stderr — carry BOTH channels verbatim rather than flattening them into
    // a sentence. A caller asserting on what the process SAID has to be able to
    // read the channel it said it on: folding the argv into one message made an
    // assertion about stderr pass on the echo of its own command line.
    const said = failure as {
      stderr?: string;
      stdout?: string;
      message?: string;
      code?: number;
    };
    throw new CliFailed(
      argv,
      said.stderr ?? "",
      said.stdout ?? "",
      said.code ?? -1,
      said.message ?? "",
    );
  }
};

/** A CLI run that exited non-zero, with the two channels and the code kept
 *  apart — which of the five arms of the exit matrix was taken is half of what
 *  these cases are about. */
class CliFailed extends Error {
  constructor(
    argv: ReadonlyArray<string>,
    readonly stderr: string,
    readonly stdout: string,
    readonly code: number,
    said: string,
  ) {
    super(`\`olai surface ${argv.join(" ")}\` failed (${code}): ${stderr.trim() || stdout.trim() || said}`);
    this.name = "CliFailed";
  }
}

/** Run something that is expected to fail, and hand back how. */
const refused = async (
  world: OlaiWorld,
  ...argv: ReadonlyArray<string>
): Promise<CliFailed> => {
  const failure = await cli(world, ...argv).then(
    () => null,
    (thrown: unknown) => thrown as CliFailed,
  );
  assert.ok(failure !== null, `\`olai surface ${argv.join(" ")}\` was accepted`);
  return failure;
};

When(
  "I capture {string} from a terminal",
  async function (this: OlaiWorld, title: string) {
    // The title is the POSITIONAL, which is the one CLI-only ergonomic this
    // verb is annotated with — `olai surface capture "…"`, not `--title`.
    lastCapture.set(this, { said: await cli(this, "capture", title) });
  },
);

/** The same call a SCRIPT makes: `--json` asks for the record whole. */
When(
  "I capture {string} from a terminal, asking for JSON",
  async function (this: OlaiWorld, title: string) {
    const said = await cli(this, "capture", title, "--json");
    const reply = JSON.parse(said) as { id?: unknown };
    assert.strictEqual(
      typeof reply.id,
      "string",
      `a capture that landed named no node: ${said}`,
    );
    lastCapture.set(this, { id: reply.id as string, said });
  },
);

/** What the last capture printed. */
const printed = (world: OlaiWorld): string => {
  const held = lastCapture.get(world);
  assert.ok(held !== undefined, "no capture has been made in this scenario yet");
  return held.said;
};

/**
 * THE LINE, and the fact it exists at all.
 *
 * A write used to print the ops layer's `Applied` record — id, title, file,
 * summary, sort, captured, rev, why, did — which is the right answer for an
 * agent and the wrong one for a person: nine fields, none of them a place. The
 * directory is named because the failure this whole redesign came from was a
 * capture landing in the wrong one and answering exactly like a capture that
 * had not.
 */
Then(
  "the terminal was told it captured into the served directory",
  function (this: OlaiWorld) {
    const said = printed(this).trim();
    assert.ok(
      said.startsWith("captured into "),
      `a capture did not say what it did: ${JSON.stringify(said)}`,
    );
    // The REAL directory this scenario's server is serving, which the harness
    // knows independently — so this cannot pass on a plausible-looking path the
    // CLI made up. `served` is set for every `@scratch:` scenario, which every
    // scenario using these steps is; a shared-corpus one would have none, and
    // that is worth saying rather than passing vacuously.
    assert.ok(this.served !== undefined, "this scenario has no served directory to name");
    assert.ok(
      said.includes(this.served),
      `the line did not name the served directory ${this.served}: ${said}`,
    );
    // ONE line: the whole point is that a person reads it without scrolling.
    assert.strictEqual(said.split("\n").length, 1, `a write printed more than one line: ${said}`);
  },
);

/** …and the other half of that line: somewhere to go. */
Then("the terminal was given a link to the row", function (this: OlaiWorld) {
  const said = printed(this).trim();
  const link = said.slice(said.lastIndexOf(" — ") + 3);
  // Addressed at THIS server, which is what makes it a link a person can paste
  // back into the browser they already have open.
  assert.ok(
    link.startsWith(this.baseUrl.replace(/\/$/, "")),
    `the line's link did not point at ${this.baseUrl}: ${said}`,
  );
  // …and at the row, not at the front page: the inbox file, then the node.
  assert.ok(link.includes("#"), `the link named no row: ${said}`);
});

/** The script's half: the record whole, and naming where it came from. */
Then(
  "the terminal was given the whole record, naming the vault",
  function (this: OlaiWorld) {
    const said = JSON.parse(printed(this)) as Record<string, unknown>;
    // The ops layer's own answer, untouched…
    assert.strictEqual(said.did, "capture");
    assert.strictEqual(typeof said.id, "string");
    assert.strictEqual(said.file, "_olai/Inbox.org");
    // …plus the two facts that say WHICH olai answered: the directory, stamped
    // by the server so it cannot be this side's guess, and the address this
    // side dialled, which the server behind a proxy could not know.
    assert.strictEqual(said.root, this.served);
    assert.strictEqual(said.url, this.baseUrl);
  },
);

/**
 * The other half of a client: the terminal READS BACK what it wrote, over the
 * same door, out of the same collection an agent reads.
 *
 * Asserted on the CLI's own stdout — which is DATA, JSON, by the discipline the
 * exit matrix publishes — so this is one binary having both written and seen
 * the line, with no browser in the loop at all.
 */
Then(
  "reading {string} from a terminal shows {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    const said = await cli(this, "get", "outlines", file);
    assert.ok(
      said.includes(title),
      `\`olai surface get outlines ${file}\` did not show ${JSON.stringify(title)}: ${said}`,
    );
  },
);

/**
 * A CAPTURE CANNOT CLAIM AN IDENTITY, and the proof is that there is no way to
 * type one.
 *
 * This used to be a refusal — the door read the caller's property map, found
 * `captured-by` in it and said no. A capture takes a title and a note now
 * (ruled, human 2026-08-23), so the map is gone and with it the only field an
 * attribution could have been put in. What a caller gets is a USAGE error, from
 * the parser, before anything is dialled: the flag does not exist.
 *
 * Exit 2 and not 1, deliberately asserted: 1 would mean the far side considered
 * it and refused, and nothing was sent at all.
 */
Then(
  "capturing while claiming {string} is not something this door takes",
  async function (this: OlaiWorld, key: string) {
    const failed = await refused(this, "capture", "forged", "--props", `${key}=someone@else`);
    assert.strictEqual(
      failed.code,
      2,
      `claiming ${key} was answered on exit ${failed.code}, not as the usage error it is`,
    );
    assert.notStrictEqual(
      failed.stderr.trim(),
      "",
      "the CLI exited non-zero and wrote NOTHING — the run edge is missing",
    );
  },
);

/**
 * AND IT CANNOT GUESS WHERE TO GO.
 *
 * The whole reason `--url` is required with nothing underneath it. A run that
 * names no server must be a usage error rather than a write into whichever
 * vault happened to be reachable — which is precisely what the reverted design
 * did, silently, and what put a capture meant for the human's vault into a
 * checkout's docs directory.
 *
 * Spawned WITHOUT the `--url` this file otherwise always passes, which is why
 * it does not go through `cli` above.
 */
Then(
  "capturing without saying which server is refused before anything is sent",
  async function (this: OlaiWorld) {
    const failure = await run(binary(), ["surface", "capture", "nowhere"], {
      env: { ...process.env },
      maxBuffer: 32 * 1024 * 1024,
    }).then(
      () => null,
      (thrown: unknown) => thrown as { code?: number; stderr?: string },
    );
    assert.ok(failure !== null, "a capture with no --url was accepted");
    assert.strictEqual(
      failure.code,
      2,
      "a capture that named no server did not exit 2 — it went somewhere",
    );
    assert.ok(
      (failure.stderr ?? "").includes("url"),
      `the refusal did not name --url: ${failure.stderr}`,
    );
  },
);

/** The id the last capture ANSWERED with — the only name a caller has for a row
 *  it did not choose an id for, which is why the verb hands one back. */
const mintedIn = (world: OlaiWorld): string => {
  const held = lastCapture.get(world);
  assert.ok(
    held?.id !== undefined,
    "no capture in this scenario asked for JSON, so no id was read back",
  );
  return held.id as string;
};

/** The node the last capture made, at its own address. */
When("I open what was captured", async function (this: OlaiWorld) {
  await this.openNode(mintedIn(this));
});

/**
 * A capture arrives DATED, and this is the half of that only a browser can
 * answer: the row is on the day page, which is where a line sent while nobody
 * was looking at the inbox gets noticed.
 *
 * Asked by ID rather than by title, because the reader never chose one — and
 * asked of `/today`, because the day a capture arrives on is the day the server
 * stamped it with, which is the day this reader is standing on.
 */
Then("what was captured is on today", async function (this: OlaiWorld) {
  await this.open("/today");
  await this.page
    .locator(`${DAY_PAGE} ${nodeSelector(mintedIn(this))}`)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
