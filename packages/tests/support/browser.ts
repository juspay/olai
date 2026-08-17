/**
 * The argv every Chromium this package launches is launched with.
 *
 * ONE list, because the reason for each flag is about where the browser RUNS
 * and not about what it is being asked to do: under Nix, in a container, on a
 * CI runner with no display and a 64 MB `/dev/shm`. Every one of them is
 * load-bearing there and harmless on a laptop, which is why the same argv is
 * used everywhere rather than branched on `CI` — a browser configured
 * differently in CI than on a laptop is a class of bug that only ever
 * reproduces where it is hardest to debug.
 *
 * It lives in its own module rather than in `./hooks.ts` beside the suite's own
 * launch, because importing that module REGISTERS cucumber hooks: a driver that
 * is not the suite (`../evidence.ts`, `../wire.ts`, `../shot.ts`) cannot reach
 * for it without also enrolling itself in a run. This file imports nothing —
 * not even from `@olai/*` — so a driver that is deliberately version-independent
 * can share it too.
 *
 * The drift this ends was real and quiet: three copies had grown, and two of
 * them had lost `--disable-dev-shm-usage` — the flag whose absence shows up as
 * a browser that dies mid-run on a small `/dev/shm`, which is exactly the
 * failure the paragraph above exists to prevent.
 */
export const BROWSER_ARGS: ReadonlyArray<string> = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--headless=new",
];
