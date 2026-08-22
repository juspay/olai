import { chromium, type Page } from "playwright";
import { mkdirSync } from "node:fs";

const SP = process.env.SP!;
const URL = process.env.URL ?? "http://127.0.0.1:7791";
const OUT = `${SP}/shots`;
mkdirSync(OUT, { recursive: true });

const sel = (id: string) => `[data-testid="${id}"]`;
const status = (page: Page) =>
  page.evaluate(() =>
    document.querySelector('[data-testid="chat-panel"]')?.getAttribute("data-status") ?? null
  );

const settle = async (page: Page): Promise<void> => {
  // The turn has to START before we can wait for it to end: a send that has not
  // reached the server yet leaves the panel idle, and an `idle` read in that
  // window is the PREVIOUS turn's.
  await page.waitForFunction(
    () => document.querySelector('[data-testid="chat-panel"]')?.getAttribute("data-status") === "thinking",
    undefined,
    { timeout: 60000 },
  );
  await page.waitForFunction(
    () => document.querySelector('[data-testid="chat-panel"]')?.getAttribute("data-status") === "idle",
    undefined,
    { timeout: 600000 },
  );
};

const ask = async (page: Page, text: string): Promise<void> => {
  await page.locator(sel("chat-input")).fill(text);
  await page.locator(sel("chat-send")).click();
};

const main = async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: `${SP}/video`, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(URL);
  await page.waitForSelector(sel("chat-toggle"), { timeout: 30000 });
  const panel = page.locator(sel("chat-panel"));
  if (!(await panel.isVisible())) await page.locator(sel("chat-toggle")).click();
  await panel.waitFor({ state: "visible", timeout: 30000 });

  // (a) the picker
  await page.waitForSelector(sel("chat-choose"), { timeout: 30000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/a-picker.png` });
  await panel.screenshot({ path: `${OUT}/a-picker-panel.png` });
  console.log("a: picker");

  await page.locator(`${sel("chat-choose-agent")}[data-agent="opencode"]`).click();
  await page.waitForSelector(sel("chat-input"), { timeout: 180000 });
  await page.waitForSelector(`${sel("chat-agent")}[data-agent="opencode"]`, { timeout: 180000 });
  await page.waitForFunction(
    () => document.querySelector('[data-testid="chat-model"]') !== null,
    undefined,
    { timeout: 180000 },
  ).catch(() => {});
  await page.waitForTimeout(1200);

  // (c) the header
  await page.screenshot({ path: `${OUT}/c-header.png` });
  await page.locator("header").first().screenshot({ path: `${OUT}/c-header-strip.png` }).catch(() => {});
  console.log("c: header", await status(page));

  // (d) a real turn, with a tool call named from the call id
  await ask(page, "Use your bash tool to run `ls` here, then say in one short sentence what you found. Do not read any files.");
  await page.waitForSelector(sel("chat-tool"), { timeout: 300000 });
  await page.waitForTimeout(400);
  await panel.screenshot({ path: `${OUT}/d-running.png` });
  await settle(page);
  await page.waitForTimeout(800);
  await panel.screenshot({ path: `${OUT}/d-turn-panel.png` });
  await page.screenshot({ path: `${OUT}/d-turn.png` });
  console.log("d: turn done");

  // (d2) a write through opencode's own `<server>_` tool naming
  await ask(page, "Using your olai tools, mark the node whose id is `order` as done. Then say what you did, in one line.");
  await settle(page);
  await page.waitForTimeout(1500);
  await panel.screenshot({ path: `${OUT}/d2-write-panel.png` });
  await page.screenshot({ path: `${OUT}/d2-write.png` });
  console.log("d2: write done");

  await context.close();
  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
