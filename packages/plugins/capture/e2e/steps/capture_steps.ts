import * as assert from "node:assert";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Then, When } from "@olai/tests/harness/runner.ts";

import { DAY_PAGE, HYDRATION_TIMEOUT, nodeSelector } from "@olai/tests/harness/world.ts";
import type { OlaiWorld } from "@olai/tests/harness/world.ts";

const run = promisify(execFile);

const lastCapture = new WeakMap<OlaiWorld, { readonly id?: string; readonly said: string }>();

const binary = (): string => {
  const bin = process.env.OLAI_BIN;
  assert.ok(
    bin !== undefined && bin !== "",
    "these steps run the real `olai` binary; set OLAI_BIN (the harness does)",
  );
  return bin;
};

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
    lastCapture.set(this, { said: await cli(this, "capture", "add", title) });
  },
);

When(
  "I capture {string} from a terminal, asking for JSON",
  async function (this: OlaiWorld, title: string) {
    const said = await cli(this, "capture", "add", title, "--json");
    const reply = JSON.parse(said) as { id?: unknown };
    assert.strictEqual(
      typeof reply.id,
      "string",
      `a capture that landed named no node: ${said}`,
    );
    lastCapture.set(this, { id: reply.id as string, said });
  },
);

const printed = (world: OlaiWorld): string => {
  const held = lastCapture.get(world);
  assert.ok(held !== undefined, "no capture has been made in this scenario yet");
  return held.said;
};

Then(
  "the terminal was told it captured into the served directory",
  function (this: OlaiWorld) {
    const said = printed(this).trim();
    assert.ok(
      said.startsWith("captured into "),
      `a capture did not say what it did: ${JSON.stringify(said)}`,
    );
    assert.ok(this.served !== undefined, "this scenario has no served directory to name");
    assert.ok(
      said.includes(this.served),
      `the line did not name the served directory ${this.served}: ${said}`,
    );
    assert.strictEqual(said.split("\n").length, 1, `a write printed more than one line: ${said}`);
  },
);

Then("the terminal was given a link to the row", function (this: OlaiWorld) {
  const said = printed(this).trim();
  const link = said.slice(said.lastIndexOf(" — ") + 3);
  assert.ok(
    link.startsWith(this.baseUrl.replace(/\/$/, "")),
    `the line's link did not point at ${this.baseUrl}: ${said}`,
  );
  assert.ok(link.includes("#"), `the link named no row: ${said}`);
});

Then(
  "the terminal was given the whole record, naming the vault",
  function (this: OlaiWorld) {
    const said = JSON.parse(printed(this)) as Record<string, unknown>;
    assert.strictEqual(said.did, "capture_add");
    assert.strictEqual(typeof said.id, "string");
    assert.strictEqual(said.file, "_olai/Inbox.olai");
    assert.strictEqual(said.root, this.served);
    assert.strictEqual(said.url, this.baseUrl);
  },
);

Then(
  "reading {string} from a terminal shows {string}",
  async function (this: OlaiWorld, file: string, title: string) {
    const said = await cli(this, "outlines", "get", "outlines", file);
    assert.ok(
      said.includes(title),
      `\`olai surface outlines get outlines ${file}\` did not show ${JSON.stringify(title)}: ${said}`,
    );
  },
);

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

Then(
  "capturing without saying which server is refused before anything is sent",
  async function (this: OlaiWorld) {
    const failure = await run(binary(), ["surface", "capture", "add", "nowhere"], {
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

const mintedIn = (world: OlaiWorld): string => {
  const held = lastCapture.get(world);
  assert.ok(
    held?.id !== undefined,
    "no capture in this scenario asked for JSON, so no id was read back",
  );
  return held.id as string;
};

When("I open what was captured", async function (this: OlaiWorld) {
  await this.openNode(mintedIn(this));
});

Then("what was captured is on today", async function (this: OlaiWorld) {
  await this.open("/today");
  await this.page
    .locator(`${DAY_PAGE} ${nodeSelector(mintedIn(this))}`)
    .first()
    .waitFor({ state: "visible", timeout: HYDRATION_TIMEOUT });
});
