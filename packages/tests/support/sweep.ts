/**
 * What a sweep over this repository reads: every file it owns, and the code in
 * one with its prose taken out.
 *
 * Three tests in this package hunt spellings across the tree —
 * `extension.test.ts` bans the extension outlines used to have, `kinds.test.ts`
 * holds the file-kind registry's monopoly, `stdio.test.ts` bans the retired
 * subcommand — and each of them was assembling the same corpus for itself, down
 * to the same failure message. The invariants below are what make such a sweep
 * honest, and they are the part that must not exist in three copies:
 *
 *   - **`git ls-files` is what "a file this repo owns" means.** The idiom is the
 *     justfile's own (`nix_files`, "so node_modules and .direnv stay out"). It is
 *     not a cheaper `readdirSync`: a hand walk with a guessed prune list swept
 *     `packages/tests/reports/`, the gitignored directory the e2e suite drops
 *     full-page failure screenshots into — megabytes of PNG read as UTF-8,
 *     growing with how much debugging the machine has done, and invisible
 *     because nothing tracks it. Tracked-only also draws the right line on WHEN:
 *     an untracked file has not landed, and these are fences about what lands.
 *   - **A listing that came back short must fail loudly**, not quietly sweep
 *     nothing. Anything other than a clean `git ls-files` throws here rather
 *     than becoming an empty array every assertion downstream would pass.
 *   - **A sweep never reads itself.** Each of these files quotes what it hunts,
 *     and one that caught its own net would teach the next reader to weaken the
 *     pattern rather than fix the code.
 *   - **What may still spell it is a LIST, and a trailing `/` is what makes an
 *     entry a directory.** Two of the three carry such a list and had written
 *     the same four lines of prefix-or-exact matching for it ({@link granting}).
 *     The rule is easy to get subtly wrong in a way nothing catches: matching
 *     every entry by prefix quietly grants `docs/format.mdx` and
 *     `docs/format.md.bak` beside the file that was meant, which is a real
 *     review finding on `extension.test.ts` rather than a hypothetical.
 *
 * WHAT IS NOT SHARED, and why. `@olai/web`'s `claims.test.ts` and `@olai/acp`'s
 * `manifest.test.ts` also walk a tree, and neither is a caller here: they walk
 * ONE PACKAGE'S directory rather than what the repository owns, they live in
 * packages that do not depend on `@olai/tests` — the dependency runs the other
 * way — and `manifest.test.ts`'s own first claim is that its package imports no
 * `@olai` sibling at all, so reaching for this file would be the thing it exists
 * to fail. The duplication that was worth closing is the one INSIDE this
 * package, where three sweeps ask the identical question of the identical tree.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/** The repository root — two directories up from this file, which lives in
 *  `packages/tests/support/`. */
export const ROOT = path.dirname(path.dirname(path.dirname(import.meta.dirname)));

/**
 * Every file this repository owns, as root-relative `/`-spelled paths, minus
 * the sweep asking. Not filtered by extension: what a caller wants differs, and
 * "everything tracked" is the only honest starting point — a `.feature`, a
 * `README.md`, an `index.html`, a `.nix` and the justfile are all places a
 * stale spelling actually lived.
 *
 * `self` is the caller's own `import.meta.filename`.
 */
export const tracked = (self: string): ReadonlyArray<string> => {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  if (listed.status !== 0) {
    throw new Error(`git ls-files failed in ${ROOT}: ${listed.stderr || listed.error}`);
  }
  const mine = path.relative(ROOT, self);
  return listed.stdout.split("\0").filter((one) => one !== "" && one !== mine);
};

/**
 * One file's text, with its comments removed — for a sweep whose claim is about
 * CODE, so prose stays free to discuss the spelling being hunted.
 *
 * `@olai/web`'s `claims.test.ts` stripper, and deliberately the same one: a line
 * comment is only taken when `//` opens the line or follows whitespace, so a
 * `https://…` inside a string survives. The cost is a comment pasted
 * mid-expression surviving too, which for a sweep means a false alarm a human
 * reads, never a silent pass.
 *
 * ONE PASS, LEFT TO RIGHT, and that is the whole of the rule: whichever comment
 * STARTS FIRST wins, and consumes through. It is not a stylistic preference —
 * two passes have a silent-pass hole whichever order they run in, and each order
 * hides the other's:
 *
 *   - **blocks first** honours a block OPENER written inside a LINE comment. A
 *     MIME type with a star in it (`// the accepted type is image/*`) opens a
 *     block that runs to the next closer, typically sixty lines further down and
 *     all of it code. `step_definitions/chat_steps.ts` and `@olai/server`'s
 *     `listener.ts` both write such a comment today, and ../selectors.test.ts'
 *     fence is what caught it, reporting three hand-built selectors in a file
 *     that plainly has four;
 *   - **lines first** honours a `//` written inside a BLOCK comment. The line
 *     rule eats to the end of that line — taking the block's CLOSER with it when
 *     the two share a line — so the block never closes and swallows everything
 *     up to whatever closer comes next. Exactly the same failure, mirrored, and
 *     it is the one a first attempt at this file introduced while closing the
 *     other.
 *
 * A single alternation cannot have either, because at the `/*` there is no line
 * comment to match and at the `//` there is no block: the scan reaches one of
 * them first and that one consumes the other. Both fixtures are held next door
 * (../sweep.test.ts), because a hole that only shows up as a sweep quietly
 * reading less is not a thing anybody notices later.
 *
 * The LEADING WHITESPACE of a line comment is put back, and so is its NEWLINE
 * (`[^\n]*` stops short of it). Stripped code therefore gains blank lines where
 * comments were, which is deliberate rather than tolerated: every sweep here
 * matches patterns against the text, two of them anchored per line with `^…`
 * under `m`, and joining the code above a comment to the code below it would
 * invent adjacencies that are not in the file. A caller that ever wants to DIFF
 * this output by line should know it is line-preserving, not line-compacting.
 */
export const withoutComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/[^\n]*/g, (_taken, lead) => lead ?? "");

/** A tracked file's contents. */
export const read = (file: string): string =>
  fs.readFileSync(path.join(ROOT, file), "utf8");

/** Whether a tracked path is really on disk. `git ls-files` goes on naming a
 *  file that is deleted in the work tree until the deletion is staged, and a
 *  missing file cannot spell anything — so a sweep that would rather skip such a
 *  path than throw at it asks this first. */
export const exists = (file: string): boolean =>
  fs.existsSync(path.join(ROOT, file));

/**
 * A grant list, as the question a sweep asks of each file: may THIS one still
 * spell the thing being hunted?
 *
 * A trailing `/` makes an entry a DIRECTORY, matched by prefix; everything else
 * is one exact path, and that asymmetry is the whole of the rule. Prefix-matching
 * the lot is the easy mistake — it grants `docs/format.mdx` and
 * `docs/format.md.bak` along with `docs/format.md`, silently — which is why the
 * rule is here once rather than re-spelled per sweep.
 */
export const granting = (
  allowed: ReadonlyArray<string>,
): ((file: string) => boolean) =>
(file: string) =>
  allowed.some((one) => (one.endsWith("/") ? file.startsWith(one) : file === one));
