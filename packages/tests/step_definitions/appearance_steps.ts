import { Then, When } from "@cucumber/cucumber";
import { FONT_STORAGE_KEY } from "@olai/fonts";
import { SIZE_STORAGE_KEY, THEME_STORAGE_KEY, TESTID } from "@olai/web/testlib";
import type { OlaiWorld } from "../support/world.ts";

When("another tab stores theme {string}, font {string}, and size {string}", async function (this: OlaiWorld, theme: string, font: string, size: string) {
  const values: Record<string, string> = { [THEME_STORAGE_KEY]: theme, [FONT_STORAGE_KEY]: font, [SIZE_STORAGE_KEY]: size };
  await this.page.evaluate((expected) => {
    const target = window as typeof window & { appearanceStorageLanded?: Promise<void> };
    target.appearanceStorageLanded = new Promise<void>((resolve) => {
      const pending = new Set(Object.keys(expected));
      const landed = (event: StorageEvent) => {
        if (event.key !== null && event.newValue === expected[event.key]) pending.delete(event.key);
        if (pending.size !== 0) return;
        window.removeEventListener("storage", landed);
        resolve();
      };
      window.addEventListener("storage", landed);
    });
  }, values);
  const other = await this.context.newPage();
  try {
    await other.goto(this.baseUrl);
    await other.evaluate((values) => {
      for (const [key, value] of Object.entries(values)) {
        // Also generate an event when the stored choice already matches.
        localStorage.removeItem(key);
        localStorage.setItem(key, value);
      }
    }, values);
    await this.page.evaluate(() => (window as typeof window & { appearanceStorageLanded?: Promise<void> }).appearanceStorageLanded);
  } finally { await other.close(); }
});

Then("the preferences plugin has no rendered controls", async function (this: OlaiWorld) {
  await this.page.getByTestId(TESTID.prefsTrigger).first().waitFor({ state: "detached" });
});

Then("the appearance attributes have been released", async function (this: OlaiWorld) {
  await this.page.waitForFunction(() => ["data-theme", "data-font", "data-size"].every((key) => !document.documentElement.hasAttribute(key)));
});

Then("the preferences have no appearance controls", async function (this: OlaiWorld) {
  for (const pref of ["theme", "font", "size"]) {
    await this.page.locator(`[data-testid="${TESTID.prefsRow}"][data-pref="${pref}"]`).waitFor({ state: "detached" });
  }
});

Then("the preferences retain their Notes control", async function (this: OlaiWorld) {
  await this.page.locator(`[data-testid="${TESTID.prefsRow}"][data-pref="density"]`).waitFor({ state: "visible" });
});
