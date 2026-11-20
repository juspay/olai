/**
 * The argv every Chromium this package launches is launched with: what a
 * browser needs where it RUNS — under Nix, in a container, on a CI runner with
 * no display and a 64 MB `/dev/shm` — and harmless anywhere else.
 */
export const BROWSER_ARGS: ReadonlyArray<string> = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--headless=new",
];
