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
 * have open — the Inbox door lights up and counts it, today's journal lists it,
 * and the `message://` pointer a captured mail holds renders as a link the
 * browser will hand to the OS. That last one is written two packages from where
 * it is allowed (`@olai/format`'s `inbox.ts` composes the autolink,
 * `@olai/web`'s `markdown/sanitise.ts` names the scheme), and this is the only
 * place the whole chain is asked at once.
 *
 * IT IS THE REAL BINARY, spawned. A fetch could not stand in for it: what is
 * being asserted includes that the socket the server bound is the one the CLI
 * walks to with no flag on either side — the convention is the feature, and a
 * harness that passed a path would assert around it. The scenario's server has
 * its own `$XDG_RUNTIME_DIR` (`support/workers.ts`), so the two find each other
 * exactly as they would for a person, and parallel workers do not collide.
 *
 * `@scratch:` on every scenario that uses these: a capture WRITES the served
 * directory, and it mints `_olai/Inbox.olai` in it.
 */

import * as assert from "node:assert";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Then, When } from "@cucumber/cucumber";

import { attr, DAY_PAGE, DESC, HYDRATION_TIMEOUT, nodeSelector } from "../support/world.ts";
import type { OlaiWorld } from "../support/world.ts";

const run = promisify(execFile);

/** The id the last capture minted, per scenario. A WeakMap rather than a field
 *  on the world: what a capture answered is this file's business, and the world
 *  is shared by fifty step modules that have no use for it. */
const lastCaptured = new WeakMap<OlaiWorld, string>();

/** The binary under test. `OLAI_BIN` is what the harness spawned the server
 *  with, so the CLI and the server are ONE build — which is the point: they
 *  share a surface definition, and a drift between them would be invisible if
 *  the test used two. */
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
 * `$OLAI_SOCKET` rather than `--socket`: the flag is the override, and what is
 * worth exercising is the rung underneath it. (A REUSED server — `OLAI_URL`
 * mode — bound its socket wherever its operator said, so the harness cannot
 * know it; that is reported here rather than guessed.)
 */
const cli = async (
  world: OlaiWorld,
  ...argv: ReadonlyArray<string>
): Promise<string> => {
  assert.ok(
    world.socketPath !== "",
    "this scenario's server did not report an agent socket; with a reused " +
      "server (OLAI_URL) set OLAI_SOCKET to the one it bound",
  );
  try {
    const { stdout } = await run(binary(), ["surface", ...argv], {
      env: { ...process.env, OLAI_SOCKET: world.socketPath },
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch (failure) {
    // The CLI writes prose to stderr and data to stdout, and a refusal is JSON
    // on stderr — carry BOTH channels verbatim rather than flattening them into
    // a sentence. A caller asserting on what the process SAID has to be able to
    // read the channel it said it on: folding the argv into one message made an
    // assertion about stderr pass on the echo of its own command line.
    const said = failure as { stderr?: string; stdout?: string; message?: string };
    throw new CliFailed(argv, said.stderr ?? "", said.stdout ?? "", said.message ?? "");
  }
};

/** A CLI run that exited non-zero, with the two channels kept apart. */
class CliFailed extends Error {
  constructor(
    argv: ReadonlyArray<string>,
    readonly stderr: string,
    readonly stdout: string,
    said: string,
  ) {
    super(`\`olai surface ${argv.join(" ")}\` failed: ${stderr.trim() || stdout.trim() || said}`);
    this.name = "CliFailed";
  }
}

/** Capture, and remember the id it answered with. */
const captured = async (
  world: OlaiWorld,
  ...argv: ReadonlyArray<string>
): Promise<void> => {
  const said = await cli(world, "capture", ...argv);
  const reply = JSON.parse(said) as { id?: unknown };
  assert.strictEqual(
    typeof reply.id,
    "string",
    `a capture that landed named no node: ${said}`,
  );
  lastCaptured.set(world, reply.id as string);
};

When(
  "I capture {string} from a terminal",
  async function (this: OlaiWorld, title: string) {
    // The title is the POSITIONAL, which is the one CLI-only ergonomic this
    // verb is annotated with — `olai surface capture "…"`, not `--title`.
    await captured(this, title);
  },
);

/** The mail case, which is what the `message:` rider is about: the pointer IS
 *  the attachment, and the note is what holds it. */
When(
  "I capture the mail {string} pointing at {string} from a terminal",
  async function (this: OlaiWorld, title: string, url: string) {
    await captured(this, title, "--text", "worth a reply", "--url", url);
  },
);

/**
 * The other half of a client: the terminal READS BACK what it wrote, over the
 * same socket, out of the same collection an agent reads.
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
 * A REFUSAL SAYS WHY, on stderr, with a non-zero code — the far end of the exit
 * matrix, asked of the real binary.
 *
 * This is not a hypothetical to guard against. Every failure the CLI face
 * raises carries `Runtime.errorReported = false` (its line is its own, and
 * Effect's pretty cause dump on top would be noise), so a host that re-fails
 * without writing that line exits with the right code and says NOTHING AT ALL.
 * This binary did exactly that until `reportingRunEdge` was applied at its run
 * edge, and a refused capture came back as a bare exit 1 with both channels
 * empty. A unit test cannot see that — it is a property of the PROCESS, of what
 * reaches a shell — so it is asserted here, where a process is what runs.
 */
Then(
  "capturing with a forged {string} is refused, saying so",
  async function (this: OlaiWorld, key: string) {
    const failed = await cli(this, "capture", "forged", "--props", `${key}=someone@else`)
      .then(
        () => null,
        (thrown: unknown) => thrown as CliFailed,
      );
    assert.ok(failed !== null, `a capture that forged ${key} was accepted`);

    // ON STDERR, and asserted THERE rather than on any sentence this file
    // composed: the command line already contains the key, so a check against a
    // message built from the argv would pass on the echo of its own input while
    // the process said nothing at all — which is exactly the bug this pins.
    assert.notStrictEqual(
      failed.stderr.trim(),
      "",
      "the CLI exited non-zero and wrote NOTHING — the run edge is missing",
    );
    assert.ok(
      failed.stderr.includes(key),
      `the refusal did not name ${key}: ${failed.stderr}`,
    );
    // …and stdout stays clean, because stdout is data.
    assert.strictEqual(failed.stdout.trim(), "", "a refusal wrote to the data channel");
  },
);

/** The id the last capture ANSWERED with — the only name a caller has for a row
 *  it did not choose an id for, which is why the verb hands one back. */
const mintedIn = (world: OlaiWorld): string => {
  const id = lastCaptured.get(world);
  assert.ok(id !== undefined, "no capture has landed in this scenario yet");
  return id;
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

/**
 * The pointer, as the BROWSER ended up with it.
 *
 * `href` off the DOM rather than the note's text, because what is being asked
 * is whether the anchor survived the sanitiser — a stripped `message:` leaves
 * the words on the page and takes the link, which reads as working.
 *
 * …and that this app did NOT claim the press either: a scheme it has no page
 * for is the browser's, and the browser hands one it cannot open to the OS. An
 * anchor this app routes is written by `<Link>`, which stamps `data-file`.
 */
Then("the note links to {string}", async function (this: OlaiWorld, href: string) {
  const anchor = this.page.locator(`${DESC} a${attr("href", href)}`).first();
  await anchor.waitFor({ state: "attached", timeout: HYDRATION_TIMEOUT });
  assert.strictEqual(
    await anchor.getAttribute("data-file"),
    null,
    "a captured mail's pointer was drawn as one of this app's own links",
  );
});
