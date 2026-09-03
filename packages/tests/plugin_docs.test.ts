/**
 * EVERY PLUGIN HAS A USER PAGE, AND EVERY PAGE IS A DOOR THE INDEX OPENS —
 * held as claims a test can be red about, because nothing else holds them.
 *
 * ## What is being kept honest, and why prose alone could not
 *
 * A plugin's user docs live in the plugin's own package
 * (`packages/plugins/<name>/docs.md`), and `@olai/plugin-api`'s `OlaiPlugin.name`
 * argues that placement against the standing ruling it looks like a breach of
 * — *"a page beside a binary is a page that goes stale"* (`@olai/server`'s
 * `main.ts`, ruled human 2026-08-23). The counter-case is that a plugin has no
 * `--help`, so `docs.md` is its ONLY account and there is no second telling to
 * drift from. That argument stands on two facts, and BOTH of them are the kind
 * that rot silently:
 *
 *   - the page EXISTS for every plugin — which stops being true the moment a
 *     plugin arrives with no `docs.md` and its story goes into some general
 *     page instead, which is the second account arriving by the back way;
 *   - the page is SERVED and LINKED, at `docs/plugins/<name>.md`, because
 *     `just serve` serves `docs/` as a vault: a path outside it is not served
 *     at all and a link to one draws as text rather than as a door. A page
 *     nobody can reach is a page nobody notices is stale, which is the
 *     ruling's own premise arriving by the other back way.
 *
 * So the claims below are the counter-case's receipts. `docs/index.md` is
 * hand-written markdown with no generator and no link checker behind it, and
 * this file is what makes it an ASSEMBLY rather than a list somebody keeps up
 * by remembering to.
 *
 * ## The served page is a SYMLINK, and the test asserts the link, not the file
 *
 * `docs/plugins/<name>.md` points at the plugin's own `docs.md` — one file
 * with two names, so the served page and the page beside the code are the same
 * bytes. `lstat` is what proves it: a well-meant COPY dropped in its place
 * would satisfy every other claim here while reintroducing exactly the
 * two-files-one-story failure the arrangement exists to refuse.
 *
 * ## …so a plugin's page is authored at its SERVED address
 *
 * A page written in `packages/plugins/<name>/` is READ at `docs/plugins/`, so
 * its relative links are the served set's (`../format.md`, and a sibling
 * plugin as `odu.md`). That is the real cost of the symlink, and it is checked
 * here rather than left to be discovered — which is more than any other page
 * under `docs/` gets today.
 *
 * ## Why the WIRE door, and why the population is not read off the tree
 *
 * `PLUGIN_NAMES` comes from `@olai/plugin-api/wire`, and the subpath is
 * load-bearing exactly as it is at `@olai/server`'s `pluginPolicy.ts`: the
 * ROOT door is the manifests, a manifest carries SolidJS faces and a terminal
 * emulator behind one of them, and importing it from a process that renders
 * nothing kills the boot rather than merely costing bytes — a `bun test` at
 * the repository root dies on `react/jsx-dev-runtime`, which is how this file
 * learned it. The wire door answers the one question a docs sweep has.
 *
 * Reading `packages/plugin-*` off the tree would have answered it too, and
 * worse: a directory is not the registry, so a page could be missing for a
 * plugin that is BUILT IN and the sweep would be green for as long as the
 * directory was absent. The registry is what ships.
 *
 * And it lives here because `@olai/tests` is the only package above all the
 * others (support/sweep.ts' header, and ../plugin-api/src/fence.test.ts' closing
 * paragraph): a sweep over `docs/` from inside `@olai/plugin-api` would be a
 * package reading the repository it is a part of.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test } from "bun:test";

import { BUNDLE_NAMES as PLUGIN_NAMES } from "@olai/bundle";

import { ROOT } from "./support/sweep.ts";

/** Where a plugin's page is AUTHORED, and where it is SERVED. The two are one
 *  file; these are its two names. Both are computed from the plugin's name,
 *  which IS the page's address (`@olai/plugin-api`'s `OlaiPlugin.name`), so
 *  nothing here spells a tenant. */
const authored = (name: string): string =>
  path.join("packages", "plugins", name, "docs.md");
const served = (name: string): string => path.join("docs", "plugins", `${name}.md`);

const at = (file: string): string => path.join(ROOT, file);

/** The docs vault's own root — what `just serve` serves with no argument, and
 *  therefore the boundary a served link may not leave. */
const VAULT = "docs";

const INDEX = "docs/index.md";

/** A guard on the sweep itself: an empty registry would pass every equality
 *  below while asserting nothing. A floor, not a count. */
test("the registry is actually being read", () => {
  expect(PLUGIN_NAMES.length).toBeGreaterThan(0);
});

test("every plugin's page sits in the plugin's own package, and has a title", () => {
  // An EQUALITY to the empty list rather than a count, so a failure names the
  // plugin and says which half is missing.
  const wrong = PLUGIN_NAMES.flatMap((name) => {
    const file = authored(name);
    if (!fs.existsSync(at(file))) return [`${file}: no such file`];
    const heading = fs.readFileSync(at(file), "utf8").split("\n")[0] ?? "";
    // A page with no `#` line is a page the index has nothing to name.
    return heading.startsWith("# ") ? [] : [`${file}: opens with ${heading}, not a heading`];
  });
  expect(wrong).toEqual([]);
});

test("the served page is a SYMLINK onto it, never a copy", () => {
  const wrong = PLUGIN_NAMES.flatMap((name) => {
    const link = served(name);
    if (!fs.existsSync(at(link))) return [`${link}: no such file`];
    if (!fs.lstatSync(at(link)).isSymbolicLink()) {
      return [`${link}: a real file — it must be a symlink onto ${authored(name)}`];
    }
    const target = path.relative(ROOT, fs.realpathSync(at(link)));
    return target === authored(name) ? [] : [`${link}: resolves to ${target}, not ${authored(name)}`];
  });
  expect(wrong).toEqual([]);
});

test("the served set holds a page per plugin and no orphan", () => {
  // Both directions at once: a page left behind by a plugin that went away is
  // as wrong as a plugin with no page, and only the listing catches the first.
  expect(fs.readdirSync(at(path.join(VAULT, "plugins"))).sort())
    .toEqual(PLUGIN_NAMES.map((name) => path.basename(served(name))).sort());
});

/** Every markdown link on a page, as the whole target of `[label](target)` —
 *  fragment included. */
const linksIn = (file: string): ReadonlyArray<string> =>
  [...fs.readFileSync(at(file), "utf8").matchAll(/\[[^\]\n]*\]\(([^)\s]+)\)/g)]
    .flatMap((hit) => (hit[1] === undefined ? [] : [hit[1]]));

/** A link that names a file in the served set — not a URL, and not a bare
 *  anchor into the page it is written on. */
const isLocal = (target: string): boolean =>
  !/^[a-z][a-z0-9+.-]*:/i.test(target) && !target.startsWith("#") && !target.startsWith("//");

/** Where a link lands, read from the page's SERVED address, as a root-relative
 *  path — `null` for one that climbs out of the vault, which is not a door at
 *  all: an unserved path draws as text. */
const landing = (from: string, target: string): string | null => {
  const address = target.split("#")[0];
  if (address === undefined || address === "") return null;
  const landed = path.normalize(path.join(path.dirname(from), address));
  return landed === VAULT || landed.startsWith(`${VAULT}${path.sep}`) ? landed : null;
};

test("every link on a plugin's page is a door at the address it is served from", () => {
  const broken = PLUGIN_NAMES.flatMap((name) => {
    const page = served(name);
    return linksIn(page).filter(isLocal).flatMap((target) => {
      const landed = landing(page, target);
      if (landed === null) return [`${page}: ${target} leaves ${VAULT}/, so it is not a door`];
      return fs.existsSync(at(landed)) ? [] : [`${page}: ${target} → ${landed}, which is not there`];
    });
  });
  expect(broken).toEqual([]);
});

test("the index links every plugin's page, and no page it does not have", () => {
  const listed = linksIn(INDEX)
    .filter((target) => target.startsWith("plugins/"))
    .map((target) => path.join(VAULT, target));
  expect([...new Set(listed)].sort()).toEqual(PLUGIN_NAMES.map((name) => served(name)).sort());
});

test("the index says something about each plugin, and not only its name", () => {
  // A link with nothing after it is a row in a list, not an index entry: the
  // whole job of this page is that a reader can tell which door they want
  // without opening all of them.
  const rows = fs.readFileSync(at(INDEX), "utf8").split("\n");
  const thin = PLUGIN_NAMES.flatMap((name) => {
    const line = rows.find((row) => row.includes(`](plugins/${name}.md)`));
    if (line === undefined) return [`${name}: no line in ${INDEX}`];
    const after = line.slice(line.indexOf(`](plugins/${name}.md)`) + `](plugins/${name}.md)`.length);
    return after.trim().length > 40 ? [] : [`${name}: the line in ${INDEX} is a link and no gloss`];
  });
  expect(thin).toEqual([]);
});

test("every page the index links is a page that is there", () => {
  // The index is hand-written and has never had a link checker. Moving a page
  // is exactly the edit that leaves a dangling neighbour behind, so the sweep
  // that would notice belongs here rather than in a second file.
  const broken = linksIn(INDEX).filter(isLocal).flatMap((target) => {
    const landed = landing(INDEX, target);
    // A link that climbs out of the vault is not a door: at the served
    // address an unserved path draws as text, and there is no page to check.
    if (landed === null) return [];
    return fs.existsSync(at(landed)) ? [] : [`${INDEX}: ${target} → ${landed}, which is not there`];
  });
  expect(broken).toEqual([]);
});
