/**
 * The install surface: the manifest, the icons, and the head of the shell.
 *
 * These steps ask the SERVER rather than the page, because that is who an
 * installer asks. The one trap they are built around is that the static layer
 * answers an unmatched path with the HTML shell — so "did it 200?" proves
 * nothing about an icon, and every assertion here is about the content type
 * that came back with it.
 */

import * as assert from "node:assert";
import { Then } from "@cucumber/cucumber";

import type { OlaiWorld } from "../support/world.ts";

/** The manifest, parsed. Fetched per step rather than cached on the world: it
 *  is a static document served by the process under test, and a step that read
 *  a copy from three steps ago would not be reading what is being served. */
const manifestOf = async (
  world: OlaiWorld,
): Promise<Record<string, unknown>> => {
  const served = await world.fetch("/manifest.webmanifest");
  assert.strictEqual(
    served.status,
    200,
    `/manifest.webmanifest answered ${served.status}`,
  );
  return JSON.parse(served.body) as Record<string, unknown>;
};

interface Icon {
  readonly src: string;
  readonly type: string;
  readonly sizes: string;
  readonly purpose?: string;
}

const iconsOf = async (world: OlaiWorld): Promise<ReadonlyArray<Icon>> => {
  const icons = (await manifestOf(world))["icons"];
  assert.ok(
    Array.isArray(icons),
    `the manifest declares no icons array (it has ${JSON.stringify(icons)})`,
  );
  return icons as ReadonlyArray<Icon>;
};

// ── what is served ─────────────────────────────────────────────────────

Then(
  "{string} is served as {string}",
  async function (this: OlaiWorld, path: string, type: string) {
    const served = await this.fetch(path);
    assert.strictEqual(served.status, 200, `${path} answered ${served.status}`);
    assert.ok(
      served.contentType.startsWith(type),
      // The likeliest wrong answer is `text/html`: the shell, served by the
      // SPA fallback because nothing matched. Naming it is what turns a
      // renamed icon into a legible failure.
      `${path} came back as "${served.contentType}", not ${type}` +
        (served.contentType.startsWith("text/html")
          ? " — that is the HTML shell, which is what an unmatched path falls back to, so nothing is being served at that URL"
          : ""),
    );
  },
);

// ── what the manifest says ─────────────────────────────────────────────

Then("the manifest is named {string}", async function (this: OlaiWorld, name: string) {
  const manifest = await manifestOf(this);
  assert.strictEqual(manifest["name"], name);
  assert.strictEqual(
    manifest["short_name"],
    name,
    "the short name is what a home screen has room for",
  );
});

Then(
  "the manifest opens {string} as a {string} app",
  async function (this: OlaiWorld, start: string, display: string) {
    const manifest = await manifestOf(this);
    assert.strictEqual(manifest["start_url"], start);
    // `standalone` is the whole difference between an installed app and a
    // bookmark: no address bar, its own window.
    assert.strictEqual(manifest["display"], display);
  },
);

Then("the manifest names {int} icons", async function (this: OlaiWorld, count: number) {
  assert.strictEqual((await iconsOf(this)).length, count);
});

Then(
  "every icon the manifest names is served as the type it claims",
  async function (this: OlaiWorld) {
    for (const icon of await iconsOf(this)) {
      const served = await this.fetch(icon.src);
      assert.strictEqual(
        served.status,
        200,
        `the manifest names ${icon.src}, which answered ${served.status}`,
      );
      assert.ok(
        served.contentType.startsWith(icon.type),
        `the manifest says ${icon.src} is ${icon.type}, but it is served as ` +
          `"${served.contentType}"`,
      );
      assert.ok(
        served.body.length > 0,
        `${icon.src} is served empty`,
      );
    }
  },
);

Then("the manifest offers a maskable icon", async function (this: OlaiWorld) {
  const icons = await iconsOf(this);
  assert.ok(
    icons.some((icon) => icon.purpose === "maskable"),
    // Without one, a platform that crops icons to its own shape crops the
    // mark itself rather than the padding around it.
    `no icon is declared maskable: ${icons.map((icon) => icon.src).join(", ")}`,
  );
});

// ── what the shell says ────────────────────────────────────────────────

Then(
  "the page's {string} is {string}",
  async function (this: OlaiWorld, rel: string, href: string) {
    const found = await this.page
      .locator(`link[rel="${rel}"]`)
      .first()
      .getAttribute("href");
    assert.strictEqual(
      found,
      href,
      `the shell has no <link rel="${rel}"> pointing at ${href}`,
    );
  },
);

Then("the page is laid out for the device width", async function (this: OlaiWorld) {
  const content = await this.page
    .locator('meta[name="viewport"]')
    .first()
    .getAttribute("content");
  assert.ok(
    content?.includes("width=device-width"),
    `the viewport meta is ${JSON.stringify(content)}`,
  );
  // The two that make a phone's chrome behave: the page may paint under the
  // notch and the home bar (which is what makes the safe-area insets real),
  // and a keyboard shrinks the viewport rather than covering it.
  assert.ok(
    content?.includes("viewport-fit=cover"),
    `the viewport meta does not cover the display cutouts: ${content}`,
  );
  assert.ok(
    content?.includes("interactive-widget=resizes-content"),
    `the viewport meta does not say what a keyboard does to it: ${content}`,
  );
});

Then("no service worker is registered", async function (this: OlaiWorld) {
  const registered = await this.page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return [];
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations.map((registration) => registration.scope);
  });
  assert.deepStrictEqual(
    registered,
    [],
    // Live or nothing: an offline shell would show outlines that had stopped
    // being true, and the framework's own lifecycle retires workers rather
    // than installing them.
    `this app has no offline mode, but a service worker is registered: ${
      registered.join(", ")
    }`,
  );
});
